import { Injectable } from '@angular/core';
import { open } from '@tauri-apps/plugin-dialog';
import {
  exists,
  mkdir,
  readDir,
  readFile as tauriReadFile,
  readTextFile,
  remove,
  rename,
  stat,
  writeFile as tauriWriteFile,
  writeTextFile,
} from '@tauri-apps/plugin-fs';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';

import type { NativeFs, NativeFsStat } from '../native-fs';
import type { PermissionState } from '../fs.types';
import { isPathRef, type NativeDirRef, type PathDirRef } from '../native-fs.types';
import { classifyFsError } from './native-fs-errors';

function joinPath(parent: PathDirRef, name: string): string {
  return `${parent.path}/${name}`;
}

function basename(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

function toPathRef(path: string): PathDirRef {
  return { kind: 'path', path, name: basename(path) };
}

// why: PathDirRef is the only shape TauriNativeFs ever produces or accepts —
//      DI only resolves this adapter when PlatformService.current === 'tauri',
//      which never constructs a browser FsDirectoryHandle. FS-007 (not a
//      classifyFsError fallback) because this isn't an IO failure — it's the
//      DI/platform-detection invariant itself breaking, which should be
//      structurally unreachable.
function assertPathRef(ref: NativeDirRef): PathDirRef {
  if (!isPathRef(ref)) {
    throw new AppError(ERROR_CODES.FS_007, {
      severity: 'fatal',
      context: { reason: 'TauriNativeFs received a browser handle ref' },
    });
  }
  return ref;
}

@Injectable({ providedIn: 'root' })
export class TauriNativeFs implements NativeFs {
  isSupported(): boolean {
    return true;
  }

  async pickDirectory(): Promise<NativeDirRef | null> {
    const selected = await open({ directory: true, multiple: false });
    return selected ? toPathRef(selected) : null;
  }

  // why: Tauri's fs capability scope is checked at build/config time, not via
  //      a runtime permission prompt like the browser — once the app is
  //      compiled with a scope covering the picked path, access is granted.
  //      There is no reauthorization flow to model on this platform.
  async queryPermission(): Promise<PermissionState> {
    return 'granted';
  }

  async requestPermission(): Promise<PermissionState> {
    return 'granted';
  }

  async requestPersistentStorage(): Promise<boolean> {
    return true;
  }

  async getOrCreateDir(parent: NativeDirRef, name: string): Promise<NativeDirRef> {
    const path = joinPath(assertPathRef(parent), name);
    try {
      if (!(await exists(path))) await mkdir(path);
    } catch (cause) {
      throw classifyFsError(cause, { name, op: 'getOrCreateDir' }, ERROR_CODES.FS_005);
    }
    return toPathRef(path);
  }

  async getDir(parent: NativeDirRef, name: string): Promise<NativeDirRef | null> {
    const path = joinPath(assertPathRef(parent), name);
    try {
      const info = await stat(path);
      return info.isDirectory ? toPathRef(path) : null;
    } catch {
      return null;
    }
  }

  // why: matches BrowserNativeFs's contract — hasEntry never throws, any
  //      failure (including a scope/permission rejection) just means "can't
  //      confirm it exists", so callers treat it as absent.
  async hasEntry(parent: NativeDirRef, name: string): Promise<boolean> {
    try {
      return await exists(joinPath(assertPathRef(parent), name));
    } catch {
      return false;
    }
  }

  async isEmpty(ref: NativeDirRef): Promise<boolean> {
    try {
      const entries = await readDir(assertPathRef(ref).path);
      return entries.length === 0;
    } catch (cause) {
      throw classifyFsError(cause, { op: 'isEmpty' }, ERROR_CODES.FS_005);
    }
  }

  async stat(parent: NativeDirRef, name: string): Promise<NativeFsStat | null> {
    try {
      const info = await stat(joinPath(assertPathRef(parent), name));
      return {
        kind: info.isDirectory ? 'dir' : 'file',
        size: info.size,
        mtimeMs: info.mtime ? new Date(info.mtime).getTime() : 0,
      };
    } catch {
      return null;
    }
  }

  async readFile(parent: NativeDirRef, name: string): Promise<File> {
    const path = joinPath(assertPathRef(parent), name);
    try {
      const bytes = await tauriReadFile(path);
      return new File([bytes as BlobPart], name);
    } catch (cause) {
      throw classifyFsError(cause, { name, op: 'read' }, ERROR_CODES.FS_005);
    }
  }

  async readJson<T>(parent: NativeDirRef, name: string): Promise<T> {
    const path = joinPath(assertPathRef(parent), name);
    try {
      const text = await readTextFile(path);
      return JSON.parse(text) as T;
    } catch (cause) {
      throw classifyFsError(cause, { name, op: 'read' }, ERROR_CODES.FS_005);
    }
  }

  async fileSize(parent: NativeDirRef, name: string): Promise<number | null> {
    try {
      const info = await stat(joinPath(assertPathRef(parent), name));
      return info.size;
    } catch {
      return null;
    }
  }

  // why: same tmp-then-rename staging as BrowserNativeFs — write the bytes to
  //      a sibling `<name>.tmp`, then swap atomically via rename() so a
  //      failure mid-write never leaves a truncated destination file.
  async writeFileAtomic(parent: NativeDirRef, name: string, contents: string): Promise<void> {
    const dir = assertPathRef(parent);
    await this.writeAtomicViaTmp(dir, name, (tmpPath) => writeTextFile(tmpPath, contents));
  }

  async writeFileAtomicBinary(
    parent: NativeDirRef,
    name: string,
    data: Blob | ArrayBuffer,
  ): Promise<void> {
    const dir = assertPathRef(parent);
    const bytes = new Uint8Array(data instanceof Blob ? await data.arrayBuffer() : data);
    await this.writeAtomicViaTmp(dir, name, (tmpPath) => tauriWriteFile(tmpPath, bytes));
  }

  private async writeAtomicViaTmp(
    dir: PathDirRef,
    name: string,
    write: (tmpPath: string) => Promise<void>,
  ): Promise<void> {
    const destPath = joinPath(dir, name);
    const tmpPath = `${destPath}.tmp`;
    let staged = false;
    try {
      await write(tmpPath);
      staged = true;
      try {
        await remove(destPath);
      } catch {
        /* may not exist yet */
      }
      await rename(tmpPath, destPath);
    } catch (cause) {
      if (!staged) {
        try {
          await remove(tmpPath);
        } catch {
          /* best effort */
        }
      }
      throw classifyFsError(cause, { name, op: 'write' }, ERROR_CODES.FS_005);
    }
  }

  async *listFiles(parent: NativeDirRef, suffix?: string): AsyncIterable<string> {
    const entries = await readDir(assertPathRef(parent).path);
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      if (suffix && !entry.name.endsWith(suffix)) continue;
      yield entry.name;
    }
  }

  async *listSubdirs(parent: NativeDirRef): AsyncIterable<string> {
    const entries = await readDir(assertPathRef(parent).path);
    for (const entry of entries) {
      if (entry.isDirectory) yield entry.name;
    }
  }

  async removeEntry(
    parent: NativeDirRef,
    name: string,
    options: { recursive?: boolean } = {},
  ): Promise<void> {
    const path = joinPath(assertPathRef(parent), name);
    if (options.recursive === undefined) await remove(path);
    else await remove(path, { recursive: options.recursive });
  }

  async moveFile(
    parent: NativeDirRef,
    name: string,
    destParent: NativeDirRef,
    destName?: string,
  ): Promise<void> {
    const src = joinPath(assertPathRef(parent), name);
    const dest = joinPath(assertPathRef(destParent), destName ?? name);
    await rename(src, dest);
  }
}
