// Adapter that exposes a node-fs-compatible surface to isomorphic-git,
// backed by a FileSystemDirectoryHandle from the File System Access API.
// Paths are interpreted as POSIX strings relative to `root` ('/' = root).

import type { FsDirectoryHandle } from '@core/fs/fs.types';

import { GitFsError, type GitFsStat, makeStat, splitPath } from './git-fs.errors';

const TEXT_DECODER = new TextDecoder();
const TEXT_ENCODER = new TextEncoder();

type ReadOpts = { encoding?: 'utf8' } | 'utf8' | undefined;

export class GitFsAdapter {
  constructor(private readonly root: FsDirectoryHandle) {}

  readonly promises = {
    readFile: (p: string, o?: ReadOpts) => this.readFile(p, o),
    writeFile: (p: string, d: Uint8Array | string) => this.writeFile(p, d),
    unlink: (p: string) => this.unlink(p),
    readdir: (p: string) => this.readdir(p),
    mkdir: (p: string) => this.mkdir(p),
    rmdir: (p: string) => this.rmdir(p),
    stat: (p: string) => this.stat(p),
    lstat: (p: string) => this.stat(p),
    readlink: (p: string) => this.readlink(p),
    symlink: (t: string, p: string) => this.symlink(t, p),
  };

  private split(path: string): { dirSegs: string[]; name: string | null } {
    const segs = splitPath(path);
    if (segs.length === 0) return { dirSegs: [], name: null };
    return { dirSegs: segs.slice(0, -1), name: segs[segs.length - 1] ?? null };
  }

  private async resolveDir(
    segments: string[],
    opts: { create?: boolean } = {},
  ): Promise<FsDirectoryHandle> {
    let dir = this.root;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]!;
      try {
        dir = (await dir.getDirectoryHandle(seg, {
          create: opts.create ?? false,
        })) as FsDirectoryHandle;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'NotFoundError') {
          throw new GitFsError('ENOENT', '/' + segments.slice(0, i + 1).join('/'), 'open');
        }
        if (e instanceof DOMException && e.name === 'TypeMismatchError') {
          throw new GitFsError('ENOTDIR', '/' + segments.slice(0, i + 1).join('/'), 'open');
        }
        throw e;
      }
    }
    return dir;
  }

  async readFile(path: string, opts?: ReadOpts): Promise<Uint8Array | string> {
    const { dirSegs, name } = this.split(path);
    if (!name) throw new GitFsError('EISDIR', path, 'open');
    const dir = await this.resolveDir(dirSegs);
    let fileHandle: FileSystemFileHandle;
    try {
      fileHandle = await dir.getFileHandle(name);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'NotFoundError') {
        throw new GitFsError('ENOENT', path, 'open');
      }
      if (e instanceof DOMException && e.name === 'TypeMismatchError') {
        throw new GitFsError('EISDIR', path, 'open');
      }
      throw e;
    }
    const file = await fileHandle.getFile();
    const buf = new Uint8Array(await file.arrayBuffer());
    const encoding = typeof opts === 'string' ? opts : opts?.encoding;
    return encoding === 'utf8' ? TEXT_DECODER.decode(buf) : buf;
  }

  async writeFile(path: string, data: Uint8Array | string): Promise<void> {
    const { dirSegs, name } = this.split(path);
    if (!name) throw new GitFsError('EISDIR', path, 'open');
    const dir = await this.resolveDir(dirSegs, { create: true });
    const handle = await dir.getFileHandle(name, { create: true });
    const writable = await handle.createWritable({ keepExistingData: false });
    // why: wrap in Blob to sidestep TS's strict ArrayBufferLike vs ArrayBuffer
    //      mismatch on FileSystemWritableFileStream.write at runtime it accepts
    //      both, but the typed signature only takes ArrayBufferView<ArrayBuffer>.
    const buf = typeof data === 'string' ? TEXT_ENCODER.encode(data) : data;
    await writable.write(new Blob([buf as BlobPart]));
    await writable.close();
  }

  async unlink(path: string): Promise<void> {
    const { dirSegs, name } = this.split(path);
    if (!name) throw new GitFsError('EISDIR', path, 'unlink');
    const dir = await this.resolveDir(dirSegs);
    // why: FS Access removeEntry doesn't distinguish files from empty dirs.
    //      Pre-check via getFileHandle so unlink-on-dir throws EISDIR like
    //      node fs does, instead of silently removing an empty directory.
    try {
      await dir.getFileHandle(name);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'NotFoundError') {
        throw new GitFsError('ENOENT', path, 'unlink');
      }
      if (e instanceof DOMException && e.name === 'TypeMismatchError') {
        throw new GitFsError('EISDIR', path, 'unlink');
      }
      throw e;
    }
    await dir.removeEntry(name);
  }

  async rmdir(path: string): Promise<void> {
    const { dirSegs, name } = this.split(path);
    if (!name) throw new GitFsError('EBUSY', path, 'rmdir');
    const dir = await this.resolveDir(dirSegs);
    try {
      await dir.removeEntry(name);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'NotFoundError') {
        throw new GitFsError('ENOENT', path, 'rmdir');
      }
      if (e instanceof DOMException && e.name === 'InvalidModificationError') {
        throw new GitFsError('ENOTEMPTY', path, 'rmdir');
      }
      throw e;
    }
  }

  async mkdir(path: string): Promise<void> {
    const { dirSegs, name } = this.split(path);
    if (!name) return;
    const parent = await this.resolveDir(dirSegs, { create: true });
    try {
      await parent.getDirectoryHandle(name);
      throw new GitFsError('EEXIST', path, 'mkdir');
    } catch (e) {
      if (e instanceof GitFsError) throw e;
      if (e instanceof DOMException && e.name === 'TypeMismatchError') {
        throw new GitFsError('EEXIST', path, 'mkdir');
      }
      if (!(e instanceof DOMException) || e.name !== 'NotFoundError') throw e;
    }
    await parent.getDirectoryHandle(name, { create: true });
  }

  async readdir(path: string): Promise<string[]> {
    const segs = splitPath(path);
    const dir = await this.resolveDir(segs);
    const out: string[] = [];
    for await (const name of dir.keys()) out.push(name);
    return out;
  }

  async stat(path: string): Promise<GitFsStat> {
    const { dirSegs, name } = this.split(path);
    const parent = await this.resolveDir(dirSegs);
    if (!name) return makeStat('dir', 0, 0);
    try {
      const fh = await parent.getFileHandle(name);
      const file = await fh.getFile();
      return makeStat('file', file.size, file.lastModified);
    } catch (e) {
      if (!(e instanceof DOMException)) throw e;
      if (e.name !== 'NotFoundError' && e.name !== 'TypeMismatchError') throw e;
    }
    try {
      await parent.getDirectoryHandle(name);
      return makeStat('dir', 0, 0);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'NotFoundError') {
        throw new GitFsError('ENOENT', path, 'stat');
      }
      throw e;
    }
  }

  async readlink(path: string): Promise<string> {
    throw new GitFsError('ENOENT', path, 'readlink');
  }

  async symlink(_target: string, path: string): Promise<void> {
    throw new GitFsError('ENOSYS', path, 'symlink');
  }
}
