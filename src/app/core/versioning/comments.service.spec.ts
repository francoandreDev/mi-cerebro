// 13c-ii — CommentsService spec. Exercises read/save on a real
// isomorphic-git repo over the MockDirHandle used by the adapter specs.
// Validates the error mapping (VER-019/020/021) and the pure
// validateAnchor helper.

import { TestBed } from '@angular/core/testing';
import * as git from 'isomorphic-git';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AppError } from '@core/errors/app-error';
import type { FsDirectoryHandle } from '@core/fs/fs.types';
import { WorkspaceService } from '@core/fs/workspace.service';

import { CommentsService } from './comments.service';
import { COMMENTS_FILE_SCHEMA_VERSION, type Comment } from './comments.types';
import { GitFsAdapter } from './git-fs.adapter';
import { VariantsService } from './variants.service';
import { PRINCIPAL_REFS, PRINCIPAL_VARIANT_ID, type Variant } from './variants.types';

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
  constructor(public readonly name: string) {}
  async getFile(): Promise<MockFile> {
    const f = new MockFile(this.contents);
    f.size = this.contents.byteLength;
    f.lastModified = this.lastModified;
    return f;
  }
  async createWritable(): Promise<MockWritable> {
    return new MockWritable(this);
  }
}
class MockDirHandle {
  kind = 'dir' as const;
  readonly entries = new Map<string, MockDirHandle | MockFileHandle>();
  constructor(public readonly name = '/') {}
  async getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<MockDirHandle> {
    const e = this.entries.get(name);
    if (e && e.kind === 'dir') return e;
    if (e && e.kind === 'file') throw new TypeMismatch();
    if (opts?.create) {
      const created = new MockDirHandle(name);
      this.entries.set(name, created);
      return created;
    }
    throw new NotFound();
  }
  async getFileHandle(name: string, opts?: { create?: boolean }): Promise<MockFileHandle> {
    const e = this.entries.get(name);
    if (e && e.kind === 'file') return e;
    if (e && e.kind === 'dir') throw new TypeMismatch();
    if (opts?.create) {
      const created = new MockFileHandle(name);
      this.entries.set(name, created);
      return created;
    }
    throw new NotFound();
  }
  async removeEntry(name: string): Promise<void> {
    if (!this.entries.has(name)) throw new NotFound();
    this.entries.delete(name);
  }
  async *keys(): AsyncIterable<string> {
    for (const k of this.entries.keys()) yield k;
  }
}

const AUTHOR = { name: 'test', email: 'test@local' } as const;

async function bootstrapWithPrincipal(): Promise<{
  root: FsDirectoryHandle;
  activeVariant: Variant;
}> {
  const mock = new MockDirHandle();
  const root = mock as unknown as FsDirectoryHandle;
  const fs = new GitFsAdapter(root);
  await git.init({ fs, dir: '/', defaultBranch: 'main' });
  await fs.promises.writeFile('/seed.txt', 'seed');
  await git.add({ fs, dir: '/', filepath: 'seed.txt' });
  const mainOid = await git.commit({ fs, dir: '/', message: 'seed', author: AUTHOR });
  await git.branch({ fs, dir: '/', ref: PRINCIPAL_REFS.comments, object: mainOid });
  await git.branch({ fs, dir: '/', ref: PRINCIPAL_REFS.draft, object: mainOid });
  const activeVariant: Variant = {
    id: PRINCIPAL_VARIANT_ID,
    name: 'Principal',
    color: '#ff7a45',
    protected: true,
    lastActivityAt: 0,
    state: 'active',
    refs: PRINCIPAL_REFS,
  };
  return { root, activeVariant };
}

describe('CommentsService', () => {
  let svc: CommentsService;
  let activeVariant: Variant;

  beforeEach(async () => {
    const bootstrapped = await bootstrapWithPrincipal();
    activeVariant = bootstrapped.activeVariant;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: WorkspaceService, useValue: { root: () => bootstrapped.root } },
        { provide: VariantsService, useValue: { getActive: () => activeVariant } },
      ],
    });
    svc = TestBed.inject(CommentsService);
  });

  it('read returns an empty file when nothing has ever been saved', async () => {
    const file = await svc.read('entity-1');
    expect(file.entityId).toBe('entity-1');
    expect(file.comments).toEqual([]);
    expect(file.schemaVersion).toBe(COMMENTS_FILE_SCHEMA_VERSION);
  });

  it('save persists comments and read returns them on the next call', async () => {
    const c: Comment = {
      id: 'c-1',
      anchorType: 'entity',
      anchor: 'entity-1',
      body: { type: 'doc', content: [{ type: 'paragraph' }] },
      createdAt: '2026-06-12T00:00:00Z',
      updatedAt: '2026-06-12T00:00:00Z',
      orphaned: false,
    };
    await svc.save('entity-1', 'Mi nota', [c]);
    const file = await svc.read('entity-1');
    expect(file.comments).toEqual([c]);
  });

  it('does not touch the working tree when saving (comments/ stays off-disk)', async () => {
    const mock = TestBed.inject(WorkspaceService).root() as unknown as MockDirHandle;
    await svc.save('entity-1', 'Mi nota', []);
    expect(mock.entries.has('comments')).toBe(false);
  });

  it('save commits to the variant comments ref, not to main', async () => {
    const root = TestBed.inject(WorkspaceService).root() as FsDirectoryHandle;
    const fs = new GitFsAdapter(root);
    const mainBefore = await git.resolveRef({ fs, dir: '/', ref: 'main' });
    await svc.save('entity-1', 'Mi nota', []);
    const mainAfter = await git.resolveRef({ fs, dir: '/', ref: 'main' });
    const commentsRef = await git.resolveRef({
      fs,
      dir: '/',
      ref: activeVariant.refs.comments,
    });
    expect(mainAfter).toBe(mainBefore);
    expect(commentsRef).not.toBe(mainBefore);
  });

  it('commit message follows `auto [comentarios]:` prefix', async () => {
    const root = TestBed.inject(WorkspaceService).root() as FsDirectoryHandle;
    const fs = new GitFsAdapter(root);
    await svc.save('entity-1', 'Mi nota', []);
    const log = await git.log({ fs, dir: '/', ref: activeVariant.refs.comments, depth: 1 });
    expect(log[0]!.commit.message.startsWith('auto [comentarios]:')).toBe(true);
    expect(log[0]!.commit.message).toContain('Mi nota');
  });

  it('throws VER-020 when the persisted file has a future schemaVersion', async () => {
    const root = TestBed.inject(WorkspaceService).root() as FsDirectoryHandle;
    const fs = new GitFsAdapter(root);
    // why: write a poisoned file directly via plumbing so read() encounters
    //      it. Future schemaVersion is the canonical "do not silently
    //      downgrade" case from §4.15.
    const poisoned = new TextEncoder().encode(
      JSON.stringify({ schemaVersion: 99, entityId: 'entity-1', comments: [] }),
    );
    const blobOid = await git.writeBlob({ fs, dir: '/', blob: poisoned });
    const commentsTip = await git.resolveRef({
      fs,
      dir: '/',
      ref: activeVariant.refs.comments,
    });
    const { commit } = await git.readCommit({ fs, dir: '/', oid: commentsTip });
    const newTree = await git.writeTree({
      fs,
      dir: '/',
      tree: [
        {
          mode: '040000',
          path: 'comments',
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
        parent: [commentsTip],
        author: { ...AUTHOR, timestamp: 1, timezoneOffset: 0 },
        committer: { ...AUTHOR, timestamp: 1, timezoneOffset: 0 },
      },
    });
    await git.writeRef({
      fs,
      dir: '/',
      ref: `refs/heads/${activeVariant.refs.comments}`,
      value: poisonedCommit,
      force: true,
    });
    // why: dropping unused vars to keep tsc quiet under noUnusedLocals.
    void commit;

    try {
      await svc.read('entity-1');
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as AppError).code).toBe('MCB-VER-020');
    }
  });

  it('validateAnchor is a no-op for `entity` anchors', () => {
    expect(() =>
      svc.validateAnchor({ anchorType: 'entity', anchor: 'x' }, new Set<string>()),
    ).not.toThrow();
  });

  it('validateAnchor throws VER-021 when a `block` anchor is not in the doc', () => {
    try {
      svc.validateAnchor({ anchorType: 'block', anchor: 'missing' }, new Set<string>(['present']));
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as AppError).code).toBe('MCB-VER-021');
    }
  });

  it('validateAnchor accepts a `block` anchor present in the doc', () => {
    expect(() =>
      svc.validateAnchor({ anchorType: 'block', anchor: 'present' }, new Set<string>(['present'])),
    ).not.toThrow();
  });
});
