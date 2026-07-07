// 13d-i — DraftsService spec. Exercises read/save on a real
// isomorphic-git repo over the MockDirHandle used by the adapter specs.
// Validates the error mapping (VER-022/023/024) and the pure
// validateAnchor helper. Mirrors comments.service.spec.ts.

import { TestBed } from '@angular/core/testing';
import * as git from 'isomorphic-git';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AppError } from '@core/errors/app-error';
import { BrowserNativeFs } from '@core/fs/adapters/browser-native-fs';
import type { FsDirectoryHandle } from '@core/fs/fs.types';
import { NATIVE_FS } from '@core/fs/native-fs';
import { WorkspaceService } from '@core/fs/workspace.service';

import { DraftsService } from './drafts.service';
import { DRAFTS_FILE_SCHEMA_VERSION, type DiffMark } from './drafts.types';
import { GitFsAdapter } from './git-fs.adapter';
import { VariantsService } from './variants.service';
import { PRINCIPAL_REFS, PRINCIPAL_VARIANT_ID, type Variant } from './variants.types';

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

async function bootstrapWithPrincipal(): Promise<{
  root: FsDirectoryHandle;
  activeVariant: Variant;
}> {
  const mock = new MockDirHandle();
  const root = mock as unknown as FsDirectoryHandle;
  const fs = new GitFsAdapter(root, nativeFs);
  await git.init({ fs, dir: '/', defaultBranch: 'main' });
  await fs.promises.writeFile('/seed.txt', 'seed');
  await git.add({ fs, dir: '/', filepath: 'seed.txt' });
  const mainOid = await git.commit({ fs, dir: '/', message: 'seed', author: AUTHOR });
  await git.branch({ fs, dir: '/', ref: PRINCIPAL_REFS.draft, object: mainOid });
  await git.branch({ fs, dir: '/', ref: PRINCIPAL_REFS.comments, object: mainOid });
  const activeVariant: Variant = {
    id: PRINCIPAL_VARIANT_ID,
    name: 'Principal',
    color: '#ff7a45',
    protected: true,
    lastActivityAt: 0,
    state: 'active',
    refs: PRINCIPAL_REFS,
    parentId: null,
    forkOid: null,
  };
  return { root, activeVariant };
}

describe('DraftsService', () => {
  let svc: DraftsService;
  let activeVariant: Variant;

  beforeEach(async () => {
    const bootstrapped = await bootstrapWithPrincipal();
    activeVariant = bootstrapped.activeVariant;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: WorkspaceService, useValue: { root: () => bootstrapped.root } },
        { provide: VariantsService, useValue: { getActive: () => activeVariant } },
        { provide: NATIVE_FS, useValue: nativeFs },
      ],
    });
    svc = TestBed.inject(DraftsService);
  });

  it('read returns an empty file when nothing has ever been saved', async () => {
    const file = await svc.read('entity-1');
    expect(file.entityId).toBe('entity-1');
    expect(file.marks).toEqual([]);
    expect(file.schemaVersion).toBe(DRAFTS_FILE_SCHEMA_VERSION);
  });

  it('save persists marks and read returns them on the next call', async () => {
    const m: DiffMark = {
      id: 'm-1',
      anchorType: 'block',
      anchor: 'block-1',
      before: { type: 'paragraph', content: [{ type: 'text', text: 'old' }] },
      after: { type: 'paragraph', content: [{ type: 'text', text: 'new' }] },
      createdAt: '2026-06-12T00:00:00Z',
      updatedAt: '2026-06-12T00:00:00Z',
    };
    await svc.save('entity-1', 'Mi nota', [m]);
    const file = await svc.read('entity-1');
    expect(file.marks).toEqual([m]);
  });

  it('does not touch the working tree when saving (drafts/ stays off-disk)', async () => {
    const mock = TestBed.inject(WorkspaceService).root() as unknown as MockDirHandle;
    await svc.save('entity-1', 'Mi nota', []);
    expect(mock.children.has('drafts')).toBe(false);
  });

  it('save commits to the variant draft ref, not to main', async () => {
    const root = TestBed.inject(WorkspaceService).root() as FsDirectoryHandle;
    const fs = new GitFsAdapter(root, nativeFs);
    const mainBefore = await git.resolveRef({ fs, dir: '/', ref: 'main' });
    await svc.save('entity-1', 'Mi nota', []);
    const mainAfter = await git.resolveRef({ fs, dir: '/', ref: 'main' });
    const draftRef = await git.resolveRef({
      fs,
      dir: '/',
      ref: activeVariant.refs.draft,
    });
    expect(mainAfter).toBe(mainBefore);
    expect(draftRef).not.toBe(mainBefore);
  });

  it('commit message follows `auto [borrador]:` prefix', async () => {
    const root = TestBed.inject(WorkspaceService).root() as FsDirectoryHandle;
    const fs = new GitFsAdapter(root, nativeFs);
    await svc.save('entity-1', 'Mi nota', []);
    const log = await git.log({ fs, dir: '/', ref: activeVariant.refs.draft, depth: 1 });
    expect(log[0]!.commit.message.startsWith('auto [borrador]:')).toBe(true);
    expect(log[0]!.commit.message).toContain('Mi nota');
  });

  it('throws VER-023 when the persisted file has a future schemaVersion', async () => {
    const root = TestBed.inject(WorkspaceService).root() as FsDirectoryHandle;
    const fs = new GitFsAdapter(root, nativeFs);
    const poisoned = new TextEncoder().encode(
      JSON.stringify({ schemaVersion: 99, entityId: 'entity-1', marks: [] }),
    );
    const blobOid = await git.writeBlob({ fs, dir: '/', blob: poisoned });
    const draftTip = await git.resolveRef({
      fs,
      dir: '/',
      ref: activeVariant.refs.draft,
    });
    const newTree = await git.writeTree({
      fs,
      dir: '/',
      tree: [
        {
          mode: '040000',
          path: 'drafts',
          type: 'tree',
          oid: await git.writeTree({
            fs,
            dir: '/',
            tree: [{ mode: '100644', path: 'entity-1.json', type: 'blob', oid: blobOid }],
          }),
        },
      ],
    });
    const poisonedCommit = await git.writeCommit({
      fs,
      dir: '/',
      commit: {
        message: 'poison',
        tree: newTree,
        parent: [draftTip],
        author: { ...AUTHOR, timestamp: 1, timezoneOffset: 0 },
        committer: { ...AUTHOR, timestamp: 1, timezoneOffset: 0 },
      },
    });
    await git.writeRef({
      fs,
      dir: '/',
      ref: `refs/heads/${activeVariant.refs.draft}`,
      value: poisonedCommit,
      force: true,
    });

    try {
      await svc.read('entity-1');
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as AppError).code).toBe('MCB-VER-023');
    }
  });

  it('validateAnchor is a no-op for `doc` anchors', () => {
    expect(() =>
      svc.validateAnchor({ anchorType: 'doc', anchor: 'x' }, new Set<string>()),
    ).not.toThrow();
  });

  it('validateAnchor throws VER-024 when a `block` anchor is not in the doc', () => {
    try {
      svc.validateAnchor({ anchorType: 'block', anchor: 'missing' }, new Set<string>(['present']));
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as AppError).code).toBe('MCB-VER-024');
    }
  });

  it('validateAnchor accepts a `block` anchor present in the doc', () => {
    expect(() =>
      svc.validateAnchor({ anchorType: 'block', anchor: 'present' }, new Set<string>(['present'])),
    ).not.toThrow();
  });
});
