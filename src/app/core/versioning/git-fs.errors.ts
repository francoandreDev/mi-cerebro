// Errors and helpers shared by GitFsAdapter and any code that interprets
// its results. Codes mirror node-fs so isomorphic-git's existing branches
// (err.code === 'ENOENT' etc.) keep working over the FS Access backend.

export class GitFsError extends Error {
  constructor(
    readonly code: string,
    readonly path: string,
    readonly syscall: string,
  ) {
    super(`${code}: ${syscall} '${path}'`);
    this.name = 'GitFsError';
  }
}

export interface GitFsStat {
  readonly type: 'file' | 'dir';
  readonly mode: number;
  readonly size: number;
  readonly ino: number;
  readonly mtimeMs: number;
  readonly ctimeMs: number;
  readonly uid: number;
  readonly gid: number;
  readonly dev: number;
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
}

export function makeStat(type: 'file' | 'dir', size: number, mtimeMs: number): GitFsStat {
  const mode = type === 'file' ? 0o100644 : 0o040755;
  return {
    type,
    mode,
    size,
    ino: 0,
    mtimeMs,
    ctimeMs: mtimeMs,
    uid: 1,
    gid: 1,
    dev: 1,
    isFile: () => type === 'file',
    isDirectory: () => type === 'dir',
    isSymbolicLink: () => false,
  };
}

export function splitPath(path: string): string[] {
  return path.split('/').filter((seg) => seg.length > 0 && seg !== '.');
}
