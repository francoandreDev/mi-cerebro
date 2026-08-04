// Integration: read/write a single blob on a non-active branch over a
// real isomorphic-git repo, backed by the same MockDirHandle the adapter
// spec uses. Confirms (a) writes land on the branch tree, (b) the main
// working tree stays untouched, (c) idempotent re-writes do not produce
// extra commits.

import * as git from 'isomorphic-git';
import { describe, expect, it } from 'vitest';

import { BrowserNativeFs } from '@core/fs/adapters/browser-native-fs';
import type { FsDirectoryHandle } from '@core/fs/fs.types';

import { listBranchDir, readBranchBlob, writeBranchBlob } from './branch-blob-ops';
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
class InvalidMod extends DOMException {
  constructor() {
    super('not empty', 'InvalidModificationError');
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

  async removeEntry(name: string, opts?: { recursive?: boolean }): Promise<void> {
    const e = this.children.get(name);
    if (!e) throw new NotFound();
    if (e.kind === 'directory' && !opts?.recursive && e.children.size > 0) throw new InvalidMod();
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
const DIR = '/';

async function bootstrapRepoWithBranch(): Promise<{ fs: GitFsAdapter; mock: MockDirHandle }> {
  const mock = new MockDirHandle();
  const fs = new GitFsAdapter(mock as unknown as FsDirectoryHandle, nativeFs);
  await git.init({ fs, dir: DIR, defaultBranch: 'main' });
  // a real first commit on main, then a sibling branch on top of it
  await fs.promises.writeFile('/seed.txt', 'seed');
  await git.add({ fs, dir: DIR, filepath: 'seed.txt' });
  const mainOid = await git.commit({ fs, dir: DIR, message: 'seed', author: AUTHOR });
  await git.branch({
    fs,
    dir: DIR,
    ref: 'variant/test/comments',
    object: mainOid,
  });
  return { fs, mock };
}

describe('branch-blob-ops', () => {
  it('returns null when the file does not exist on the branch', async () => {
    const { fs } = await bootstrapRepoWithBranch();
    const got = await readBranchBlob(fs, 'variant/test/comments', 'comments/abc.json');
    expect(got).toBeNull();
  });

  it('returns null when the ref does not exist', async () => {
    const { fs } = await bootstrapRepoWithBranch();
    const got = await readBranchBlob(fs, 'variant/ghost/comments', 'comments/abc.json');
    expect(got).toBeNull();
  });

  it('writes a blob on the branch and reads it back', async () => {
    const { fs, mock } = await bootstrapRepoWithBranch();
    const content = new TextEncoder().encode('{"hello":"world"}');
    const commitOid = await writeBranchBlob({
      fs,
      ref: 'variant/test/comments',
      filepath: 'comments/abc.json',
      content,
      message: 'auto [comentarios]: x (1 comentario)',
      author: AUTHOR,
    });
    expect(commitOid).not.toBeNull();

    const got = await readBranchBlob(fs, 'variant/test/comments', 'comments/abc.json');
    expect(got).not.toBeNull();
    expect(new TextDecoder().decode(got!)).toBe('{"hello":"world"}');

    // why: working tree should NOT have a `comments/` directory — the
    //      branch was updated via plumbing without checkout.
    expect(mock.children.has('comments')).toBe(false);
  });

  it('is idempotent: writing the same content twice returns null on the 2nd call', async () => {
    const { fs } = await bootstrapRepoWithBranch();
    const content = new TextEncoder().encode('{"hello":"world"}');
    const first = await writeBranchBlob({
      fs,
      ref: 'variant/test/comments',
      filepath: 'comments/abc.json',
      content,
      message: 'auto [comentarios]: x (1)',
      author: AUTHOR,
    });
    const second = await writeBranchBlob({
      fs,
      ref: 'variant/test/comments',
      filepath: 'comments/abc.json',
      content,
      message: 'auto [comentarios]: x (1)',
      author: AUTHOR,
    });
    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it('keeps main pointing at the original tip after writing on the sibling branch', async () => {
    const { fs } = await bootstrapRepoWithBranch();
    const mainBefore = await git.resolveRef({ fs, dir: DIR, ref: 'main' });
    await writeBranchBlob({
      fs,
      ref: 'variant/test/comments',
      filepath: 'comments/abc.json',
      content: new TextEncoder().encode('payload'),
      message: 'msg',
      author: AUTHOR,
    });
    const mainAfter = await git.resolveRef({ fs, dir: DIR, ref: 'main' });
    expect(mainAfter).toBe(mainBefore);
  });
});

describe('listBranchDir', () => {
  it('returns an empty list when the ref does not exist', async () => {
    const { fs } = await bootstrapRepoWithBranch();
    expect(await listBranchDir(fs, 'variant/ghost/comments', 'comments')).toEqual([]);
  });

  it('returns an empty list when the directory has never been written', async () => {
    const { fs } = await bootstrapRepoWithBranch();
    expect(await listBranchDir(fs, 'variant/test/comments', 'comments')).toEqual([]);
  });

  it('lists every blob written directly under the directory, not files outside it', async () => {
    const { fs } = await bootstrapRepoWithBranch();
    await writeBranchBlob({
      fs,
      ref: 'variant/test/comments',
      filepath: 'comments/a.json',
      content: new TextEncoder().encode('{}'),
      message: 'm1',
      author: AUTHOR,
    });
    await writeBranchBlob({
      fs,
      ref: 'variant/test/comments',
      filepath: 'comments/b.json',
      content: new TextEncoder().encode('{}'),
      message: 'm2',
      author: AUTHOR,
    });
    await writeBranchBlob({
      fs,
      ref: 'variant/test/comments',
      filepath: 'other/c.json',
      content: new TextEncoder().encode('{}'),
      message: 'm3',
      author: AUTHOR,
    });
    const entries = await listBranchDir(fs, 'variant/test/comments', 'comments');
    expect(entries.map((e) => e.path).sort()).toEqual(['comments/a.json', 'comments/b.json']);
  });
});
