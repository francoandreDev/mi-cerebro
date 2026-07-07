import { Injectable } from '@angular/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';

import type { NativeFs, NativeFsStat } from '../native-fs';
import type { PermissionState } from '../fs.types';
import { isPathRef, type NativeDirRef, type PathDirRef } from '../native-fs.types';
import { classifyFsError } from './native-fs-errors';

// why: no folder picker on mobile (user's scope decision) — the workspace
//      always lives under this fixed, app-managed subfolder of the user's
//      Documents directory. Documents (not Data) so the files stay visible/
//      exportable to the user, matching PROYECTO.md §4.14 ("el usuario es
//      dueño de sus datos") instead of an app-private sandbox lost on
//      uninstall without the user ever seeing it.
const WORKSPACE_ROOT = 'mi-cerebro';
const CAPACITOR_DIR = Directory.Documents;

function joinPath(parent: PathDirRef, name: string): string {
  return parent.path ? `${parent.path}/${name}` : name;
}

// why: WorkspaceService's Capacitor bootstrap branch (18e) needs a starting
//      ref to pass to getOrCreateDir before the fixed workspace folder
//      exists — an empty path joins to a bare relative name (no leading
//      slash), which is what Directory.Documents expects as its root.
export function documentsRootRef(): PathDirRef {
  return { kind: 'path', path: '', name: '' };
}

function basename(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

function toPathRef(path: string): PathDirRef {
  return { kind: 'path', path, name: basename(path) };
}

// why: FS-007 (not a classifyFsError fallback) because this isn't an IO
//      failure — it's the DI/platform-detection invariant itself breaking
//      (DI only resolves this adapter when PlatformService.current ===
//      'capacitor'), which should be structurally unreachable.
function assertPathRef(ref: NativeDirRef): PathDirRef {
  if (!isPathRef(ref)) {
    throw new AppError(ERROR_CODES.FS_007, {
      severity: 'fatal',
      context: { reason: 'CapacitorNativeFs received a browser handle ref' },
    });
  }
  return ref;
}

function toUint8Array(data: string | Blob): Promise<Uint8Array> | Uint8Array {
  if (typeof data === 'string') {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  return data.arrayBuffer().then((buf) => new Uint8Array(buf));
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

@Injectable({ providedIn: 'root' })
export class CapacitorNativeFs implements NativeFs {
  isSupported(): boolean {
    return true;
  }

  // why: fixed-directory model — there's nothing for the user to pick on
  //      mobile. A call here would break the fixed-root invariant that
  //      WorkspaceService's Capacitor bootstrap branch (18e) relies on, so
  //      fail loud instead of silently no-op-ing.
  async pickDirectory(): Promise<NativeDirRef | null> {
    throw new AppError(ERROR_CODES.FS_001, {
      severity: 'fatal',
      context: { reason: 'pickDirectory is not supported on Capacitor (fixed workspace folder)' },
    });
  }

  // why: no mid-session revocation model for a fixed app-managed folder
  //      under Documents — same rationale as TauriNativeFs.
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
      if (!(await this.exists(path))) {
        await Filesystem.mkdir({ path, directory: CAPACITOR_DIR, recursive: true });
      }
    } catch (cause) {
      throw classifyFsError(cause, { name, op: 'getOrCreateDir' }, ERROR_CODES.FS_006);
    }
    return toPathRef(path);
  }

  async getDir(parent: NativeDirRef, name: string): Promise<NativeDirRef | null> {
    const path = joinPath(assertPathRef(parent), name);
    try {
      const info = await Filesystem.stat({ path, directory: CAPACITOR_DIR });
      return info.type === 'directory' ? toPathRef(path) : null;
    } catch {
      return null;
    }
  }

  async hasEntry(parent: NativeDirRef, name: string): Promise<boolean> {
    return this.exists(joinPath(assertPathRef(parent), name));
  }

  private async exists(path: string): Promise<boolean> {
    try {
      await Filesystem.stat({ path, directory: CAPACITOR_DIR });
      return true;
    } catch {
      return false;
    }
  }

  async isEmpty(ref: NativeDirRef): Promise<boolean> {
    const { files } = await Filesystem.readdir({
      path: assertPathRef(ref).path,
      directory: CAPACITOR_DIR,
    });
    return files.length === 0;
  }

  async stat(parent: NativeDirRef, name: string): Promise<NativeFsStat | null> {
    try {
      const info = await Filesystem.stat({
        path: joinPath(assertPathRef(parent), name),
        directory: CAPACITOR_DIR,
      });
      return {
        kind: info.type === 'directory' ? 'dir' : 'file',
        size: info.size,
        mtimeMs: info.mtime ?? 0,
      };
    } catch {
      return null;
    }
  }

  async readFile(parent: NativeDirRef, name: string): Promise<File> {
    const path = joinPath(assertPathRef(parent), name);
    try {
      const { data } = await Filesystem.readFile({ path, directory: CAPACITOR_DIR });
      const bytes = await toUint8Array(data);
      return new File([bytes as BlobPart], name);
    } catch (cause) {
      throw classifyFsError(cause, { name, op: 'read' }, ERROR_CODES.FS_006);
    }
  }

  async readJson<T>(parent: NativeDirRef, name: string): Promise<T> {
    const path = joinPath(assertPathRef(parent), name);
    try {
      const { data } = await Filesystem.readFile({
        path,
        directory: CAPACITOR_DIR,
        encoding: Encoding.UTF8,
      });
      return JSON.parse(data as string) as T;
    } catch (cause) {
      throw classifyFsError(cause, { name, op: 'read' }, ERROR_CODES.FS_006);
    }
  }

  async fileSize(parent: NativeDirRef, name: string): Promise<number | null> {
    try {
      const info = await Filesystem.stat({
        path: joinPath(assertPathRef(parent), name),
        directory: CAPACITOR_DIR,
      });
      return info.size;
    } catch {
      return null;
    }
  }

  // why: same tmp-then-rename staging as the other adapters — Filesystem.rename
  //      is atomic at the OS level on both Android and iOS.
  async writeFileAtomic(parent: NativeDirRef, name: string, contents: string): Promise<void> {
    const dir = assertPathRef(parent);
    await this.writeAtomicViaTmp(dir, name, (tmpPath) =>
      Filesystem.writeFile({
        path: tmpPath,
        data: contents,
        directory: CAPACITOR_DIR,
        encoding: Encoding.UTF8,
      }),
    );
  }

  async writeFileAtomicBinary(
    parent: NativeDirRef,
    name: string,
    data: Blob | ArrayBuffer,
  ): Promise<void> {
    const dir = assertPathRef(parent);
    const bytes = new Uint8Array(data instanceof Blob ? await data.arrayBuffer() : data);
    const base64 = toBase64(bytes);
    await this.writeAtomicViaTmp(dir, name, (tmpPath) =>
      Filesystem.writeFile({ path: tmpPath, data: base64, directory: CAPACITOR_DIR }),
    );
  }

  private async writeAtomicViaTmp(
    dir: PathDirRef,
    name: string,
    write: (tmpPath: string) => Promise<unknown>,
  ): Promise<void> {
    const destPath = joinPath(dir, name);
    const tmpPath = `${destPath}.tmp`;
    let staged = false;
    try {
      await write(tmpPath);
      staged = true;
      try {
        await Filesystem.deleteFile({ path: destPath, directory: CAPACITOR_DIR });
      } catch {
        /* may not exist yet */
      }
      await Filesystem.rename({
        from: tmpPath,
        to: destPath,
        directory: CAPACITOR_DIR,
      });
    } catch (cause) {
      if (!staged) {
        try {
          await Filesystem.deleteFile({ path: tmpPath, directory: CAPACITOR_DIR });
        } catch {
          /* best effort */
        }
      }
      throw classifyFsError(cause, { name, op: 'write' }, ERROR_CODES.FS_006);
    }
  }

  async *listFiles(parent: NativeDirRef, suffix?: string): AsyncIterable<string> {
    const { files } = await Filesystem.readdir({
      path: assertPathRef(parent).path,
      directory: CAPACITOR_DIR,
    });
    for (const entry of files) {
      if (entry.type !== 'file') continue;
      if (suffix && !entry.name.endsWith(suffix)) continue;
      yield entry.name;
    }
  }

  async *listSubdirs(parent: NativeDirRef): AsyncIterable<string> {
    const { files } = await Filesystem.readdir({
      path: assertPathRef(parent).path,
      directory: CAPACITOR_DIR,
    });
    for (const entry of files) {
      if (entry.type === 'directory') yield entry.name;
    }
  }

  async removeEntry(
    parent: NativeDirRef,
    name: string,
    options: { recursive?: boolean } = {},
  ): Promise<void> {
    const path = joinPath(assertPathRef(parent), name);
    try {
      await Filesystem.deleteFile({ path, directory: CAPACITOR_DIR });
    } catch {
      if (options.recursive === undefined) {
        await Filesystem.rmdir({ path, directory: CAPACITOR_DIR });
      } else {
        await Filesystem.rmdir({ path, directory: CAPACITOR_DIR, recursive: options.recursive });
      }
    }
  }

  async moveFile(
    parent: NativeDirRef,
    name: string,
    destParent: NativeDirRef,
    destName?: string,
  ): Promise<void> {
    const from = joinPath(assertPathRef(parent), name);
    const to = joinPath(assertPathRef(destParent), destName ?? name);
    await Filesystem.rename({ from, to, directory: CAPACITOR_DIR });
  }
}

export { WORKSPACE_ROOT as CAPACITOR_WORKSPACE_ROOT };
