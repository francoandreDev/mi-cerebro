// §12 — CompactionService spec. Builds a real isomorphic-git repo over
// the MockDirHandle pattern, seeds commits with backdated timestamps so
// they fall into the daily-fuse bucket, then exercises planForBranch +
// applyPlan end-to-end. Validates rewrite, Compacted-From trailer,
// snapshot file, and idempotence (second run is a no-op).

import { TestBed } from '@angular/core/testing';
import * as git from 'isomorphic-git';
import { beforeEach, describe, expect, it } from 'vitest';

import { AutosaveService } from '../autosave/autosave.service';
import { BrowserNativeFs } from '../fs/adapters/browser-native-fs';
import { FsLockService } from '../fs/fs-lock.service';
import type { FsDirectoryHandle } from '../fs/fs.types';
import { NATIVE_FS } from '../fs/native-fs';
import { WorkspaceService } from '../fs/workspace.service';

import { CompactionService } from './compaction.service';
import { GitFsAdapter } from './git-fs.adapter';

const nativeFs = new BrowserNativeFs();

class NotFound extends DOMException {
  constructor() {
    super('not found', 'NotFoundError');
  }
}
class TypeMismatch extends DOMException {
  constructor() {
    super('type mismatch', 'TypeMismatchError');
  }
}

let mockClock = 1700000000000;

class MockFile {
  constructor(public data: Uint8Array) {}
  size = 0;
  lastModified = mockClock;
  async arrayBuffer(): Promise<ArrayBuffer> {
    return this.data.buffer.slice(
      this.data.byteOffset,
      this.data.byteOffset + this.data.byteLength,
    ) as ArrayBuffer;
  }
}
class MockWritable {
  constructor(private readonly target: MockFileHandle) {}
  async write(data: Uint8Array | string | Blob): Promise<void> {
    if (typeof data === 'string') this.target.contents = new TextEncoder().encode(data);
    else if (data instanceof Blob) this.target.contents = new Uint8Array(await data.arrayBuffer());
    else this.target.contents = new Uint8Array(data);
    mockClock += 1000;
    this.target.lastModified = mockClock;
  }
  async close(): Promise<void> {
    /* no-op */
  }
}
class MockFileHandle {
  kind = 'file' as const;
  contents = new Uint8Array();
  lastModified = mockClock;
  constructor(
    public name: string,
    private parent?: MockDirHandle,
  ) {}
  async getFile(): Promise<MockFile> {
    const f = new MockFile(this.contents);
    f.size = this.contents.byteLength;
    f.lastModified = this.lastModified;
    return f;
  }
  async createWritable(): Promise<MockWritable> {
    return new MockWritable(this);
  }
  async move(dest: MockDirHandle, newName?: string): Promise<void> {
    const targetName = newName ?? this.name;
    if (this.parent) this.parent.children.delete(this.name);
    this.name = targetName;
    this.parent = dest;
    dest.children.set(targetName, this);
  }
}
class MockDirHandle {
  kind = 'directory' as const;
  readonly children = new Map<string, MockDirHandle | MockFileHandle>();
  constructor(public readonly name = '/') {}
  async getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<MockDirHandle> {
    const e = this.children.get(name);
    if (e && e.kind === 'directory') return e;
    if (e && e.kind === 'file') throw new TypeMismatch();
    if (opts?.create) {
      const created = new MockDirHandle(name);
      this.children.set(name, created);
      return created;
    }
    throw new NotFound();
  }
  async getFileHandle(name: string, opts?: { create?: boolean }): Promise<MockFileHandle> {
    const e = this.children.get(name);
    if (e && e.kind === 'file') return e;
    if (e && e.kind === 'directory') throw new TypeMismatch();
    if (opts?.create) {
      const created = new MockFileHandle(name, this);
      this.children.set(name, created);
      return created;
    }
    throw new NotFound();
  }
  async removeEntry(name: string): Promise<void> {
    if (!this.children.has(name)) throw new NotFound();
    this.children.delete(name);
  }
  async *keys(): AsyncIterable<string> {
    for (const k of this.children.keys()) yield k;
  }

  async *entries(): AsyncIterable<[string, MockDirHandle | MockFileHandle]> {
    for (const [k, v] of this.children) yield [k, v];
  }
}

const AUTHOR = { name: 'test', email: 'test@local' } as const;
const DAY = 86_400_000;

async function seed(): Promise<{ root: FsDirectoryHandle; fs: GitFsAdapter }> {
  const mock = new MockDirHandle();
  const root = mock as unknown as FsDirectoryHandle;
  const fs = new GitFsAdapter(root, nativeFs);
  await git.init({ fs, dir: '/', defaultBranch: 'main' });
  return { root, fs };
}

// Commits with a controlled author timestamp (seconds) so the planner
// classifies them deterministically against `Date.now()`.
async function commitAt(
  fs: GitFsAdapter,
  filepath: string,
  content: string,
  message: string,
  whenMs: number,
): Promise<string> {
  await fs.promises.writeFile(filepath, content);
  await git.add({ fs, dir: '/', filepath: filepath.replace(/^\//, '') });
  return git.commit({
    fs,
    dir: '/',
    message,
    author: { ...AUTHOR, timestamp: Math.floor(whenMs / 1000), timezoneOffset: 0 },
  });
}

function getDirByPath(mock: MockDirHandle, path: string): MockDirHandle | null {
  const parts = path.split('/').filter(Boolean);
  let cur: MockDirHandle = mock;
  for (const p of parts) {
    const e = cur.children.get(p);
    if (!e || e.kind !== 'directory') return null;
    cur = e;
  }
  return cur;
}

describe('CompactionService', () => {
  let svc: CompactionService;
  let fs: GitFsAdapter;
  let root: FsDirectoryHandle;

  beforeEach(async () => {
    const seeded = await seed();
    root = seeded.root;
    fs = seeded.fs;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: WorkspaceService, useValue: { root: () => root } },
        { provide: AutosaveService, useValue: { flushAll: async () => undefined } },
        { provide: NATIVE_FS, useValue: nativeFs },
        FsLockService,
      ],
    });
    svc = TestBed.inject(CompactionService);
  });

  it('applies a trivial plan: 3 old same-day commits fuse into 1', async () => {
    // 15 days ago, same UTC day → fall into 'daily' bucket together.
    const base = Date.now() - 15 * DAY;
    await commitAt(fs, '/a.txt', 'A1', 'auto: A1', base);
    await commitAt(fs, '/a.txt', 'A2', 'auto: A2', base + 1000);
    const lastOld = await commitAt(fs, '/a.txt', 'A3', 'auto: A3', base + 2000);
    // Recent commit (today) — never fused.
    const recent = await commitAt(fs, '/a.txt', 'A4', 'auto: A4', Date.now());

    const plan = await svc.planForBranch('main');
    expect(plan.fuseGroups.length).toBe(1);
    expect(plan.fuseGroups[0]!.oids.length).toBe(3);
    expect(plan.fuseGroups[0]!.oids[2]).toBe(lastOld);

    const result = await svc.applyPlan('main', plan);
    expect(result.rewrote).toBe(true);

    const log = await git.log({ fs, dir: '/', ref: 'main' });
    // 3 fused → 1 commit + recent kept → 2 total.
    expect(log).toHaveLength(2);
    // Tip is the rewritten "recent" commit; it still points at A4's tree.
    const tipBlob = await git.readBlob({ fs, dir: '/', oid: log[0]!.oid, filepath: 'a.txt' });
    expect(new TextDecoder().decode(tipBlob.blob)).toBe('A4');
    // The fused commit (parent of tip) carries the trailer and the
    // final tree of the original group.
    const fused = log[1]!;
    expect(fused.commit.message).toMatch(/^auto-batch \[main\]: 3 commits \(\d{4}-\d{2}-\d{2}\)/);
    expect(fused.commit.message).toContain('Compacted-From:');
    const fusedBlob = await git.readBlob({ fs, dir: '/', oid: fused.oid, filepath: 'a.txt' });
    expect(new TextDecoder().decode(fusedBlob.blob)).toBe('A3');

    // The original `recent` oid no longer appears — its content was
    // rewritten under a new oid (parents changed).
    const oids = log.map((c) => c.oid);
    expect(oids).not.toContain(recent);
  });

  it('writes a pre-compaction snapshot before rewriting refs', async () => {
    const base = Date.now() - 15 * DAY;
    await commitAt(fs, '/a.txt', 'A1', 'auto: A1', base);
    await commitAt(fs, '/a.txt', 'A2', 'auto: A2', base + 1000);
    await commitAt(fs, '/a.txt', 'A3', 'auto: A3', base + 2000);

    const plan = await svc.planForBranch('main');
    await svc.applyPlan('main', plan);

    const mock = root as unknown as MockDirHandle;
    const snapshotRoot = getDirByPath(mock, '.mi-cerebro/pre-compaction');
    expect(snapshotRoot).not.toBeNull();
    const stamps = Array.from(snapshotRoot!.children.keys());
    expect(stamps.length).toBe(1);
    const branchDir = getDirByPath(mock, `.mi-cerebro/pre-compaction/${stamps[0]}/main`);
    expect(branchDir).not.toBeNull();
    const planFile = branchDir!.children.get('plan.json');
    expect(planFile?.kind).toBe('file');
    const payload = JSON.parse(new TextDecoder().decode((planFile as MockFileHandle).contents)) as {
      ref: string;
      originalTipOid: string;
      fuseGroups: unknown[];
    };
    expect(payload.ref).toBe('main');
    expect(payload.originalTipOid).toMatch(/^[0-9a-f]{40}$/);
    expect(payload.fuseGroups.length).toBe(1);
  });

  it('is idempotent: running again on a compacted branch is a no-op', async () => {
    const base = Date.now() - 15 * DAY;
    await commitAt(fs, '/a.txt', 'A1', 'auto: A1', base);
    await commitAt(fs, '/a.txt', 'A2', 'auto: A2', base + 1000);
    await commitAt(fs, '/a.txt', 'A3', 'auto: A3', base + 2000);

    const plan1 = await svc.planForBranch('main');
    await svc.applyPlan('main', plan1);
    const tipAfterFirst = await git.resolveRef({ fs, dir: '/', ref: 'main' });

    const plan2 = await svc.planForBranch('main');
    expect(plan2.fuseGroups.length).toBe(0);
    const result2 = await svc.applyPlan('main', plan2);
    expect(result2.rewrote).toBe(false);
    const tipAfterSecond = await git.resolveRef({ fs, dir: '/', ref: 'main' });
    expect(tipAfterSecond).toBe(tipAfterFirst);
  });
});
