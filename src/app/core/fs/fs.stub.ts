import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';

import type { FsDirectoryHandle } from './fs.types';

export interface InMemoryDir {
  readonly name: string;
  readonly files: Map<string, string>;
  readonly dirs: Map<string, InMemoryDir>;
}

export const makeDir = (name: string): InMemoryDir => ({
  name,
  files: new Map(),
  dirs: new Map(),
});

export class FsStub {
  readonly root = makeDir('mc');
  private resolve(handle: unknown): InMemoryDir {
    return handle as unknown as InMemoryDir;
  }
  isSupported(): boolean {
    return true;
  }
  async getOrCreateDir(parent: unknown, name: string): Promise<unknown> {
    const p = this.resolve(parent);
    if (!p.dirs.has(name)) p.dirs.set(name, makeDir(name));
    return p.dirs.get(name) as unknown;
  }
  async getDir(parent: unknown, name: string): Promise<unknown> {
    const p = this.resolve(parent);
    return p.dirs.get(name) ?? null;
  }
  async getOrCreateFile(): Promise<unknown> {
    throw new AppError(ERROR_CODES.FS_001, { severity: 'error', context: { reason: 'stub' } });
  }
  async writeFileAtomic(parent: unknown, name: string, contents: string): Promise<void> {
    this.resolve(parent).files.set(name, contents);
  }
  async readJson<T>(parent: unknown, name: string): Promise<T> {
    const text = this.resolve(parent).files.get(name);
    if (!text) throw new AppError(ERROR_CODES.FS_003, { severity: 'error', context: { name } });
    return JSON.parse(text) as T;
  }
  async *listFiles(parent: unknown, suffix?: string): AsyncIterable<string> {
    for (const name of this.resolve(parent).files.keys()) {
      if (suffix && !name.endsWith(suffix)) continue;
      yield name;
    }
  }
  async *listSubdirs(parent: unknown): AsyncIterable<string> {
    for (const name of this.resolve(parent).dirs.keys()) yield name;
  }
  async hasEntry(parent: unknown, name: string): Promise<boolean> {
    const p = this.resolve(parent);
    return p.files.has(name) || p.dirs.has(name);
  }
  async removeEntry(
    parent: unknown,
    name: string,
    options: { recursive?: boolean } = {},
  ): Promise<void> {
    const p = this.resolve(parent);
    if (p.files.delete(name)) return;
    const d = p.dirs.get(name);
    if (!d) return;
    if (!options.recursive && (d.files.size > 0 || d.dirs.size > 0)) {
      throw new AppError(ERROR_CODES.FS_001, {
        severity: 'error',
        context: { reason: 'not empty', name },
      });
    }
    p.dirs.delete(name);
  }
  async moveFile(
    parent: unknown,
    name: string,
    destParent: unknown,
    destName?: string,
  ): Promise<void> {
    const src = this.resolve(parent);
    const dst = this.resolve(destParent);
    const contents = src.files.get(name);
    if (contents === undefined)
      throw new AppError(ERROR_CODES.FS_003, { severity: 'error', context: { name } });
    src.files.delete(name);
    dst.files.set(destName ?? name, contents);
  }
}

export class WorkspaceStub {
  constructor(private readonly handle: unknown) {}
  root(): FsDirectoryHandle {
    return this.handle as FsDirectoryHandle;
  }
  // why: real WorkspaceService.isReady is a computed signal, called as a
  //      function — services that gate an effect on it (SettingsService,
  //      WritingStatsService) need this stub to answer truthily so tests
  //      that transitively construct those services (e.g. via BooksService)
  //      don't crash on a missing method.
  isReady(): boolean {
    return true;
  }
}
