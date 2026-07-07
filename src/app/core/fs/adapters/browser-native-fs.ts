import { Injectable } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';

import type { NativeFs, NativeFsStat } from '../native-fs';
import type { FsDirectoryHandle, FsFileHandle, PermissionState } from '../fs.types';
import { isPathRef, type NativeDirRef } from '../native-fs.types';
import { classifyFsError } from './native-fs-errors';

// why: PathDirRef never reaches this adapter in practice — DI only resolves
//      BrowserNativeFs when PlatformService.current === 'browser', which
//      never constructs a path ref. Fail loud rather than silently mis-typing
//      a downstream native handle call if that invariant is ever broken.
function assertBrowserRef(ref: NativeDirRef): FsDirectoryHandle {
  if (isPathRef(ref)) {
    throw new AppError(ERROR_CODES.FS_001, {
      severity: 'fatal',
      context: { reason: 'BrowserNativeFs received a path ref', path: ref.path },
    });
  }
  return ref;
}

@Injectable({ providedIn: 'root' })
export class BrowserNativeFs implements NativeFs {
  isSupported(): boolean {
    return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
  }

  async pickDirectory(): Promise<NativeDirRef | null> {
    if (!this.isSupported()) {
      throw new AppError(ERROR_CODES.SYS_001, { severity: 'fatal' });
    }
    try {
      // why: showDirectoryPicker rejects with AbortError when user cancels;
      //      that is not an error, just a no-op back to caller.
      return await window.showDirectoryPicker!({ mode: 'readwrite', id: 'mc-root' });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return null;
      throw new AppError(ERROR_CODES.FS_001, { severity: 'error', cause });
    }
  }

  async queryPermission(ref: NativeDirRef): Promise<PermissionState> {
    return assertBrowserRef(ref).queryPermission({ mode: 'readwrite' });
  }

  async requestPermission(ref: NativeDirRef): Promise<PermissionState> {
    return assertBrowserRef(ref).requestPermission({ mode: 'readwrite' });
  }

  async requestPersistentStorage(): Promise<boolean> {
    if (!navigator.storage?.persist) return false;
    return navigator.storage.persist();
  }

  async getOrCreateDir(parent: NativeDirRef, name: string): Promise<NativeDirRef> {
    return assertBrowserRef(parent).getDirectoryHandle(name, {
      create: true,
    }) as Promise<FsDirectoryHandle>;
  }

  async hasEntry(parent: NativeDirRef, name: string): Promise<boolean> {
    const dir = assertBrowserRef(parent);
    try {
      await dir.getDirectoryHandle(name);
      return true;
    } catch {
      try {
        await dir.getFileHandle(name);
        return true;
      } catch {
        return false;
      }
    }
  }

  async isEmpty(ref: NativeDirRef): Promise<boolean> {
    for await (const _ of assertBrowserRef(ref).keys()) {
      void _;
      return false;
    }
    return true;
  }

  // why: mirrors the probe order GitFsAdapter.stat used to do inline before
  //      18d — try file first, then dir, so a name that briefly collides
  //      with both (created/removed mid-walk) still resolves deterministically.
  async stat(parent: NativeDirRef, name: string): Promise<NativeFsStat | null> {
    const dir = assertBrowserRef(parent);
    try {
      const fh = await dir.getFileHandle(name);
      const file = await fh.getFile();
      return { kind: 'file', size: file.size, mtimeMs: file.lastModified };
    } catch {
      /* fall through to dir probe */
    }
    try {
      await dir.getDirectoryHandle(name);
      return { kind: 'dir', size: 0, mtimeMs: 0 };
    } catch {
      return null;
    }
  }

  // why: createWritable({keepExistingData:false}) truncates the destination
  //      immediately, so any failure between createWritable() and close()
  //      leaves an empty file on disk. We instead stage the bytes in a
  //      sibling `<name>.tmp`, then swap atomically: remove the old dest
  //      (if any) and move the tmp into place. If anything fails before
  //      the swap, dest is untouched; if it fails during cleanup, the
  //      .tmp remains and the next refresh ignores it (suffix mismatch).
  async writeFileAtomic(parent: NativeDirRef, name: string, contents: string): Promise<void> {
    await this.writeAtomicViaTmp(assertBrowserRef(parent), name, (w) => w.write(contents));
  }

  async writeFileAtomicBinary(
    parent: NativeDirRef,
    name: string,
    data: Blob | ArrayBuffer,
  ): Promise<void> {
    await this.writeAtomicViaTmp(assertBrowserRef(parent), name, (w) => w.write(data));
  }

  private async writeAtomicViaTmp(
    parent: FsDirectoryHandle,
    name: string,
    write: (w: FileSystemWritableFileStream) => Promise<void>,
  ): Promise<void> {
    const tmp = `${name}.tmp`;
    let staged = false;
    try {
      const tmpHandle = (await parent.getFileHandle(tmp, { create: true })) as FsFileHandle;
      const writable = await tmpHandle.createWritable({ keepExistingData: false });
      await write(writable);
      await writable.close();
      staged = true;
      try {
        await parent.removeEntry(name);
      } catch {
        /* may not exist yet */
      }
      await tmpHandle.move(parent, name);
    } catch (cause) {
      if (!staged) {
        try {
          await parent.removeEntry(tmp);
        } catch {
          /* best effort */
        }
      }
      throw classifyFsError(cause, { name, op: 'write' });
    }
  }

  async fileSize(parent: NativeDirRef, name: string): Promise<number | null> {
    try {
      const handle = await assertBrowserRef(parent).getFileHandle(name);
      const file = await handle.getFile();
      return file.size;
    } catch {
      return null;
    }
  }

  async readFile(parent: NativeDirRef, name: string): Promise<File> {
    try {
      const handle = await assertBrowserRef(parent).getFileHandle(name);
      return await handle.getFile();
    } catch (cause) {
      throw classifyFsError(cause, { name, op: 'read' });
    }
  }

  async readJson<T>(parent: NativeDirRef, name: string): Promise<T> {
    try {
      const handle = await assertBrowserRef(parent).getFileHandle(name);
      const file = await handle.getFile();
      const text = await file.text();
      return JSON.parse(text) as T;
    } catch (cause) {
      throw classifyFsError(cause, { name, op: 'read' });
    }
  }

  async *listFiles(parent: NativeDirRef, suffix?: string): AsyncIterable<string> {
    for await (const [name, entry] of assertBrowserRef(parent).entries()) {
      if (entry.kind !== 'file') continue;
      if (suffix && !name.endsWith(suffix)) continue;
      yield name;
    }
  }

  async removeEntry(
    parent: NativeDirRef,
    name: string,
    options: { recursive?: boolean } = {},
  ): Promise<void> {
    await assertBrowserRef(parent).removeEntry(name, options);
  }

  async *listSubdirs(parent: NativeDirRef): AsyncIterable<string> {
    for await (const [name, entry] of assertBrowserRef(parent).entries()) {
      if (entry.kind !== 'directory') continue;
      yield name;
    }
  }

  async getDir(parent: NativeDirRef, name: string): Promise<NativeDirRef | null> {
    try {
      return (await assertBrowserRef(parent).getDirectoryHandle(name)) as FsDirectoryHandle;
    } catch {
      return null;
    }
  }

  async moveFile(
    parent: NativeDirRef,
    name: string,
    destParent: NativeDirRef,
    destName?: string,
  ): Promise<void> {
    const handle = (await assertBrowserRef(parent).getFileHandle(name)) as FsFileHandle;
    const dest = assertBrowserRef(destParent);
    if (destName) await handle.move(dest, destName);
    else await handle.move(dest);
  }
}
