// VersioningService — focused on ensureRepo()'s one-time `.git` → OPFS
// migration (docs/deferred/versionado.md). Reuses the same MockDirHandle
// harness as git-fs.integration.spec.ts, but with two SEPARATE mock trees
// standing in for the real FS root and the OPFS root, wired via stubbed
// WorkspaceService/OpfsGitRootService — the point is to prove the
// copy → verify → delete sequence actually preserves history and never
// touches the original before the copy is confirmed readable.

import { TestBed } from '@angular/core/testing';
import * as git from 'isomorphic-git';
import { beforeEach, describe, expect, it } from 'vitest';

import { BrowserNativeFs } from '@core/fs/adapters/browser-native-fs';
import type { FsDirectoryHandle } from '@core/fs/fs.types';
import { NATIVE_FS } from '@core/fs/native-fs';
import { WorkspaceService } from '@core/fs/workspace.service';

import { GitFsAdapter } from './git-fs.adapter';
import { OpfsGitRootService } from './opfs-git-root';
import { VersioningService } from './versioning.service';
import { DEFAULT_GITIGNORE } from './versioning.constants';

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
class InvalidMod extends DOMException {
  constructor() {
    super('not empty', 'InvalidModificationError');
  }
}

class MockFile {
  constructor(public data: Uint8Array) {}
  size = 0;
  lastModified = 1700000000000;
  async arrayBuffer(): Promise<ArrayBuffer> {
    return this.data.buffer.slice(
      this.data.byteOffset,
      this.data.byteOffset + this.data.byteLength,
    ) as ArrayBuffer;
  }
}

let mockClock = 1700000000000;

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
  async createWritable(_o?: unknown): Promise<MockWritable> {
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

  async removeEntry(name: string, opts?: { recursive?: boolean }): Promise<void> {
    const e = this.children.get(name);
    if (!e) throw new NotFound();
    if (e.kind === 'directory' && !opts?.recursive && e.children.size > 0) {
      throw new InvalidMod();
    }
    this.children.delete(name);
  }

  async *keys(): AsyncIterable<string> {
    for (const k of this.children.keys()) yield k;
  }

  async *entries(): AsyncIterable<[string, MockDirHandle | MockFileHandle]> {
    for (const [k, v] of this.children) yield [k, v];
  }
}

function makeRoot(): { root: FsDirectoryHandle; mock: MockDirHandle } {
  const mock = new MockDirHandle();
  return { root: mock as unknown as FsDirectoryHandle, mock };
}

const AUTHOR = { name: 'test', email: 'test@local' };
const DIR = '/';

async function seedLegacyRepo(root: FsDirectoryHandle): Promise<{ oid: string }> {
  const fs = new GitFsAdapter(root, nativeFs);
  await git.init({ fs, dir: DIR, defaultBranch: 'main' });
  await fs.promises.writeFile('/.gitignore', DEFAULT_GITIGNORE);
  await fs.promises.writeFile('/notes/n1.json', '{"id":"n1","title":"antes de la migración"}');
  await git.add({ fs, dir: DIR, filepath: 'notes/n1.json' });
  await git.add({ fs, dir: DIR, filepath: '.gitignore' });
  const oid = await git.commit({ fs, dir: DIR, message: 'seed', author: AUTHOR });
  return { oid };
}

describe('VersioningService — ensureRepo() OPFS migration', () => {
  let realRoot: FsDirectoryHandle;
  let realMock: MockDirHandle;
  let opfsRoot: FsDirectoryHandle;
  let opfsMock: MockDirHandle;
  let opfsAvailable = true;

  beforeEach(() => {
    ({ root: realRoot, mock: realMock } = makeRoot());
    ({ root: opfsRoot, mock: opfsMock } = makeRoot());
    opfsAvailable = true;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: NATIVE_FS, useValue: nativeFs },
        { provide: WorkspaceService, useValue: { root: () => realRoot } },
        {
          provide: OpfsGitRootService,
          useValue: { getGitDir: async () => (opfsAvailable ? opfsRoot : null) },
        },
      ],
    });
  });

  it('copies an existing real-FS repo into OPFS and removes the original', async () => {
    const { oid } = await seedLegacyRepo(realRoot);
    const versioning = TestBed.inject(VersioningService);

    await versioning.ensureRepo();

    expect(realMock.children.has('.git')).toBe(false);
    // opfsRoot IS the `.git` dir itself (that's what getGitDir() returns
    // in production too — see OpfsGitRootService.resolveGitDir), so its
    // contents are HEAD/objects/refs directly, no nested `.git/`.
    expect(opfsMock.children.has('HEAD')).toBe(true);
    expect(opfsMock.children.has('objects')).toBe(true);

    const log = await versioning.log(10);
    expect(log).toHaveLength(1);
    expect(log[0]!.oid).toBe(oid);

    const blob = await versioning.readBlob(oid, 'notes/n1.json');
    expect(new TextDecoder().decode(blob)).toContain('antes de la migración');
  });

  it('workdir files (non-.git) stay on the real FS after migration', async () => {
    await seedLegacyRepo(realRoot);
    const versioning = TestBed.inject(VersioningService);
    await versioning.ensureRepo();

    expect(realMock.children.has('notes')).toBe(true);
    expect(opfsMock.children.has('notes')).toBe(false);
  });

  it('does nothing when OPFS is unavailable — real .git is left as-is', async () => {
    opfsAvailable = false;
    await seedLegacyRepo(realRoot);
    const versioning = TestBed.inject(VersioningService);

    await versioning.ensureRepo();

    expect(realMock.children.has('.git')).toBe(true);
    const log = await versioning.log(10);
    expect(log).toHaveLength(1);
  });

  it('is idempotent — a second ensureRepo() does not re-copy or error', async () => {
    const { oid } = await seedLegacyRepo(realRoot);
    const versioning = TestBed.inject(VersioningService);
    await versioning.ensureRepo();

    // Fresh service instance (simulates a reload): re-resolves adapters,
    // but OPFS already has HEAD, so the migration guard must short-circuit.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: NATIVE_FS, useValue: nativeFs },
        { provide: WorkspaceService, useValue: { root: () => realRoot } },
        { provide: OpfsGitRootService, useValue: { getGitDir: async () => opfsRoot } },
      ],
    });
    const versioning2 = TestBed.inject(VersioningService);
    await versioning2.ensureRepo();

    const log = await versioning2.log(10);
    expect(log).toHaveLength(1);
    expect(log[0]!.oid).toBe(oid);
  });

  it('brand-new workspace (no legacy .git) just inits fresh in OPFS, nothing to migrate', async () => {
    const versioning = TestBed.inject(VersioningService);
    await versioning.ensureRepo();

    expect(realMock.children.has('.git')).toBe(false);
    expect(opfsMock.children.has('HEAD')).toBe(true);
    // why: isomorphic-git throws on log() against an unborn HEAD (no
    //      commits yet) — same behavior git-fs.integration.spec.ts's
    //      caso 1 works around, not something this migration changes.
    const log = await versioning.log(10).catch(() => []);
    expect(log).toEqual([]);
  });
});
