// Adapter that exposes a node-fs-compatible surface to isomorphic-git,
// backed by NativeFs (browser File System Access API, Tauri plugin-fs, or
// Capacitor Filesystem depending on platform). Paths are interpreted as
// POSIX strings relative to `root` ('/' = root).
//
// Optional `gitDirRoot` (docs/deferred/versionado.md — `.git/` on OPFS):
// when set, any path under `/.git` resolves against `gitDirRoot` instead
// of `root` — the workdir (user's files) stays on the real FS, only git's
// own objects/refs/index move. isomorphic-git itself never knows; it
// keeps calling `dir: '/'` and defaults `gitdir` to `dir + '/.git'`, which
// is exactly the prefix this routes on. When `gitDirRoot` is omitted
// (OPFS unavailable — Tauri/Capacitor, or the browser lacks OPFS) this
// behaves exactly as before, single root, no routing overhead beyond one
// string check per call.

import type { NativeFs } from '@core/fs/native-fs';
import type { NativeDirRef } from '@core/fs/native-fs.types';

import { GitFsError, type GitFsStat, makeStat, splitPath } from './git-fs.errors';

const TEXT_DECODER = new TextDecoder();
const GIT_PREFIX = '/.git';

export type ReadOpts = { encoding?: 'utf8' } | 'utf8' | undefined;

export class GitFsAdapter {
  constructor(
    private readonly root: NativeDirRef,
    private readonly fs: NativeFs,
    private readonly gitDirRoot: NativeDirRef | null = null,
  ) {}

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

  // why: routes by the ORIGINAL path (before splitting into segments) —
  //      `/.git` itself maps to the gitDirRoot's own root ('/'), anything
  //      under `/.git/` maps to that same path with the prefix stripped.
  //      Anything else (workdir files) is untouched, base = this.root.
  private baseFor(path: string): { base: NativeDirRef; rel: string } {
    if (this.gitDirRoot) {
      if (path === GIT_PREFIX) return { base: this.gitDirRoot, rel: '/' };
      if (path.startsWith(`${GIT_PREFIX}/`)) {
        return { base: this.gitDirRoot, rel: path.slice(GIT_PREFIX.length) };
      }
    }
    return { base: this.root, rel: path };
  }

  private split(path: string): { dirSegs: string[]; name: string | null } {
    const segs = splitPath(path);
    if (segs.length === 0) return { dirSegs: [], name: null };
    return { dirSegs: segs.slice(0, -1), name: segs[segs.length - 1] ?? null };
  }

  // why: walks segment-by-segment via NativeFs.stat/getDir instead of raw
  //      FileSystemDirectoryHandle traversal, so ENOENT vs ENOTDIR come from
  //      a platform-neutral stat() shape rather than DOMException.name (which
  //      only browser adapters produce).
  private async resolveDir(
    base: NativeDirRef,
    segments: string[],
    opts: { create?: boolean } = {},
  ): Promise<NativeDirRef> {
    let dir = base;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]!;
      const info = await this.fs.stat(dir, seg);
      if (!info) {
        if (opts.create) {
          dir = await this.fs.getOrCreateDir(dir, seg);
          continue;
        }
        throw new GitFsError('ENOENT', '/' + segments.slice(0, i + 1).join('/'), 'open');
      }
      if (info.kind !== 'dir') {
        throw new GitFsError('ENOTDIR', '/' + segments.slice(0, i + 1).join('/'), 'open');
      }
      const next = await this.fs.getDir(dir, seg);
      if (!next) throw new GitFsError('ENOENT', '/' + segments.slice(0, i + 1).join('/'), 'open');
      dir = next;
    }
    return dir;
  }

  async readFile(path: string, opts?: ReadOpts): Promise<Uint8Array | string> {
    const { base, rel } = this.baseFor(path);
    const { dirSegs, name } = this.split(rel);
    if (!name) throw new GitFsError('EISDIR', path, 'open');
    const dir = await this.resolveDir(base, dirSegs);
    const info = await this.fs.stat(dir, name);
    if (!info) throw new GitFsError('ENOENT', path, 'open');
    if (info.kind !== 'file') throw new GitFsError('EISDIR', path, 'open');
    const file = await this.fs.readFile(dir, name);
    const buf = new Uint8Array(await file.arrayBuffer());
    const encoding = typeof opts === 'string' ? opts : opts?.encoding;
    return encoding === 'utf8' ? TEXT_DECODER.decode(buf) : buf;
  }

  async writeFile(path: string, data: Uint8Array | string): Promise<void> {
    const { base, rel } = this.baseFor(path);
    const { dirSegs, name } = this.split(rel);
    if (!name) throw new GitFsError('EISDIR', path, 'open');
    const dir = await this.resolveDir(base, dirSegs, { create: true });
    if (typeof data === 'string') {
      await this.fs.writeFileAtomic(dir, name, data);
    } else {
      // why: Blob wrapping sidesteps the same ArrayBufferLike vs ArrayBuffer
      //      typing mismatch writeFileAtomicBinary's callers hit elsewhere.
      await this.fs.writeFileAtomicBinary(dir, name, new Blob([data as BlobPart]));
    }
  }

  async unlink(path: string): Promise<void> {
    const { base, rel } = this.baseFor(path);
    const { dirSegs, name } = this.split(rel);
    if (!name) throw new GitFsError('EISDIR', path, 'unlink');
    const dir = await this.resolveDir(base, dirSegs);
    // why: node fs unlink() throws EISDIR on a directory instead of silently
    //      removing it — stat first so that keeps holding under NativeFs too.
    const info = await this.fs.stat(dir, name);
    if (!info) throw new GitFsError('ENOENT', path, 'unlink');
    if (info.kind === 'dir') throw new GitFsError('EISDIR', path, 'unlink');
    await this.fs.removeEntry(dir, name);
  }

  async rmdir(path: string): Promise<void> {
    const { base, rel } = this.baseFor(path);
    const { dirSegs, name } = this.split(rel);
    if (!name) throw new GitFsError('EBUSY', path, 'rmdir');
    const dir = await this.resolveDir(base, dirSegs);
    const info = await this.fs.stat(dir, name);
    if (!info) throw new GitFsError('ENOENT', path, 'rmdir');
    const target = await this.fs.getDir(dir, name);
    if (target && !(await this.fs.isEmpty(target))) {
      throw new GitFsError('ENOTEMPTY', path, 'rmdir');
    }
    await this.fs.removeEntry(dir, name);
  }

  async mkdir(path: string): Promise<void> {
    const { base, rel } = this.baseFor(path);
    const { dirSegs, name } = this.split(rel);
    if (!name) return;
    const parent = await this.resolveDir(base, dirSegs, { create: true });
    if (await this.fs.hasEntry(parent, name)) {
      throw new GitFsError('EEXIST', path, 'mkdir');
    }
    await this.fs.getOrCreateDir(parent, name);
  }

  async readdir(path: string): Promise<string[]> {
    const { base, rel } = this.baseFor(path);
    const segs = splitPath(rel);
    const dir = await this.resolveDir(base, segs);
    const out: string[] = [];
    for await (const name of this.fs.listFiles(dir)) out.push(name);
    for await (const name of this.fs.listSubdirs(dir)) out.push(name);
    return out;
  }

  async stat(path: string): Promise<GitFsStat> {
    const { base, rel } = this.baseFor(path);
    const { dirSegs, name } = this.split(rel);
    const parent = await this.resolveDir(base, dirSegs);
    if (!name) return makeStat('dir', 0, 0);
    const info = await this.fs.stat(parent, name);
    if (!info) throw new GitFsError('ENOENT', path, 'stat');
    return makeStat(info.kind, info.size, info.mtimeMs);
  }

  async readlink(path: string): Promise<string> {
    throw new GitFsError('ENOENT', path, 'readlink');
  }

  async symlink(_target: string, path: string): Promise<void> {
    throw new GitFsError('ENOSYS', path, 'symlink');
  }
}
