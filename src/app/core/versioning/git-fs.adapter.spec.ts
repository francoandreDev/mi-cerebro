import { describe, expect, it } from 'vitest';

import { BrowserNativeFs } from '@core/fs/adapters/browser-native-fs';
import type { FsDirectoryHandle } from '@core/fs/fs.types';

import { GitFsAdapter } from './git-fs.adapter';
import { GitFsError } from './git-fs.errors';

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

class MockWritable {
  constructor(private readonly target: MockFileHandle) {}
  async write(data: Uint8Array | string | Blob): Promise<void> {
    if (typeof data === 'string') {
      this.target.contents = new TextEncoder().encode(data);
    } else if (data instanceof Blob) {
      this.target.contents = new Uint8Array(await data.arrayBuffer());
    } else {
      this.target.contents = new Uint8Array(data);
    }
  }
  async close(): Promise<void> {
    // mock no-op
  }
}

class MockFileHandle {
  kind = 'file' as const;
  contents = new Uint8Array();
  constructor(
    public name: string,
    private parent?: MockDirHandle,
  ) {}
  async getFile(): Promise<MockFile> {
    const f = new MockFile(this.contents);
    f.size = this.contents.byteLength;
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

describe('GitFsAdapter', () => {
  it('writes and reads a file as Uint8Array and utf8', async () => {
    const { root } = makeRoot();
    const fs = new GitFsAdapter(root, nativeFs);
    await fs.promises.writeFile('/.git/HEAD', 'ref: refs/heads/main\n');
    const buf = (await fs.promises.readFile('/.git/HEAD')) as unknown as Uint8Array<ArrayBuffer>;
    expect(buf).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(buf)).toBe('ref: refs/heads/main\n');
    const text = (await fs.promises.readFile('/.git/HEAD', { encoding: 'utf8' })) as string;
    expect(text).toBe('ref: refs/heads/main\n');
  });

  it('writeFile creates missing parent directories', async () => {
    const { root, mock } = makeRoot();
    const fs = new GitFsAdapter(root, nativeFs);
    await fs.promises.writeFile('/.git/refs/heads/main', 'abc');
    const git = mock.children.get('.git') as MockDirHandle;
    const refs = git.children.get('refs') as MockDirHandle;
    const heads = refs.children.get('heads') as MockDirHandle;
    expect(heads.children.has('main')).toBe(true);
  });

  it('readFile throws ENOENT for missing path', async () => {
    const { root } = makeRoot();
    const fs = new GitFsAdapter(root, nativeFs);
    await expect(fs.promises.readFile('/missing')).rejects.toMatchObject({
      name: 'GitFsError',
      code: 'ENOENT',
    });
  });

  it('readFile throws ENOTDIR when traversing through a file', async () => {
    const { root } = makeRoot();
    const fs = new GitFsAdapter(root, nativeFs);
    await fs.promises.writeFile('/a', 'x');
    await expect(fs.promises.readFile('/a/b')).rejects.toMatchObject({ code: 'ENOTDIR' });
  });

  it('mkdir creates and EEXISTs on second call', async () => {
    const { root } = makeRoot();
    const fs = new GitFsAdapter(root, nativeFs);
    await fs.promises.mkdir('/objects');
    await expect(fs.promises.mkdir('/objects')).rejects.toMatchObject({ code: 'EEXIST' });
  });

  it('mkdir EEXISTs when a file with the same name exists', async () => {
    const { root } = makeRoot();
    const fs = new GitFsAdapter(root, nativeFs);
    await fs.promises.writeFile('/x', 'y');
    await expect(fs.promises.mkdir('/x')).rejects.toMatchObject({ code: 'EEXIST' });
  });

  it('readdir lists entries of a dir', async () => {
    const { root } = makeRoot();
    const fs = new GitFsAdapter(root, nativeFs);
    await fs.promises.writeFile('/.git/HEAD', '1');
    await fs.promises.mkdir('/.git/objects');
    await fs.promises.mkdir('/.git/refs');
    const names = await fs.promises.readdir('/.git');
    expect(names.sort()).toEqual(['HEAD', 'objects', 'refs']);
  });

  it('stat distinguishes file and dir; ENOENT on missing', async () => {
    const { root } = makeRoot();
    const fs = new GitFsAdapter(root, nativeFs);
    await fs.promises.writeFile('/a', 'hello');
    await fs.promises.mkdir('/b');
    const sa = await fs.promises.stat('/a');
    const sb = await fs.promises.stat('/b');
    expect(sa.isFile()).toBe(true);
    expect(sa.size).toBe(5);
    expect(sb.isDirectory()).toBe(true);
    await expect(fs.promises.stat('/c')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('unlink removes a file; ENOENT on missing; EISDIR on a directory', async () => {
    const { root } = makeRoot();
    const fs = new GitFsAdapter(root, nativeFs);
    await fs.promises.writeFile('/a', 'x');
    await fs.promises.unlink('/a');
    await expect(fs.promises.stat('/a')).rejects.toMatchObject({ code: 'ENOENT' });
    await fs.promises.mkdir('/d');
    await expect(fs.promises.unlink('/d')).rejects.toMatchObject({ code: 'EISDIR' });
    await expect(fs.promises.unlink('/missing')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rmdir removes empty dir; ENOTEMPTY if not empty', async () => {
    const { root } = makeRoot();
    const fs = new GitFsAdapter(root, nativeFs);
    await fs.promises.mkdir('/a');
    await fs.promises.rmdir('/a');
    await fs.promises.writeFile('/b/c', 'x');
    await expect(fs.promises.rmdir('/b')).rejects.toMatchObject({ code: 'ENOTEMPTY' });
  });

  it('symlink/readlink reject (FS Access has no symlinks)', async () => {
    const { root } = makeRoot();
    const fs = new GitFsAdapter(root, nativeFs);
    await expect(fs.promises.symlink('/a', '/b')).rejects.toBeInstanceOf(GitFsError);
    await expect(fs.promises.readlink('/a')).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
