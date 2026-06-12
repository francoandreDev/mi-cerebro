// Integration: read/write a single blob on a non-active branch over a
// real isomorphic-git repo, backed by the same MockDirHandle the adapter
// spec uses. Confirms (a) writes land on the branch tree, (b) the main
// working tree stays untouched, (c) idempotent re-writes do not produce
// extra commits.

import * as git from 'isomorphic-git';
import { describe, expect, it } from 'vitest';

import type { FsDirectoryHandle } from '@core/fs/fs.types';

import { readBranchBlob, writeBranchBlob } from './branch-blob-ops';
import { GitFsAdapter } from './git-fs.adapter';

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

  async removeEntry(name: string, opts?: { recursive?: boolean }): Promise<void> {
    const e = this.entries.get(name);
    if (!e) throw new NotFound();
    if (e.kind === 'dir' && !opts?.recursive && e.entries.size > 0) throw new InvalidMod();
    this.entries.delete(name);
  }

  async *keys(): AsyncIterable<string> {
    for (const k of this.entries.keys()) yield k;
  }
}

const AUTHOR = { name: 'test', email: 'test@local' } as const;
const DIR = '/';

async function bootstrapRepoWithBranch(): Promise<{ fs: GitFsAdapter; mock: MockDirHandle }> {
  const mock = new MockDirHandle();
  const fs = new GitFsAdapter(mock as unknown as FsDirectoryHandle);
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
    expect(mock.entries.has('comments')).toBe(false);
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
