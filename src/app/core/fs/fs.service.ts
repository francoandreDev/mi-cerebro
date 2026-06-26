import { Injectable } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';

import type { FsDirectoryHandle, FsFileHandle, PermissionState } from './fs.types';

@Injectable({ providedIn: 'root' })
export class FsService {
  isSupported(): boolean {
    return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
  }

  async pickDirectory(): Promise<FsDirectoryHandle | null> {
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

  async queryPermission(handle: FsDirectoryHandle): Promise<PermissionState> {
    return handle.queryPermission({ mode: 'readwrite' });
  }

  async requestPermission(handle: FsDirectoryHandle): Promise<PermissionState> {
    return handle.requestPermission({ mode: 'readwrite' });
  }

  async requestPersistentStorage(): Promise<boolean> {
    if (!navigator.storage?.persist) return false;
    return navigator.storage.persist();
  }

  async getOrCreateDir(parent: FsDirectoryHandle, name: string): Promise<FsDirectoryHandle> {
    return parent.getDirectoryHandle(name, { create: true }) as Promise<FsDirectoryHandle>;
  }

  async getOrCreateFile(parent: FsDirectoryHandle, name: string): Promise<FileSystemFileHandle> {
    return parent.getFileHandle(name, { create: true });
  }

  async hasEntry(parent: FsDirectoryHandle, name: string): Promise<boolean> {
    try {
      await parent.getDirectoryHandle(name);
      return true;
    } catch {
      try {
        await parent.getFileHandle(name);
        return true;
      } catch {
        return false;
      }
    }
  }

  async isEmpty(handle: FsDirectoryHandle): Promise<boolean> {
    for await (const _ of handle.keys()) {
      void _;
      return false;
    }
    return true;
  }

  // why: createWritable({keepExistingData:false}) truncates the destination
  //      immediately, so any failure between createWritable() and close()
  //      leaves an empty file on disk. We instead stage the bytes in a
  //      sibling `<name>.tmp`, then swap atomically: remove the old dest
  //      (if any) and move the tmp into place. If anything fails before
  //      the swap, dest is untouched; if it fails during cleanup, the
  //      .tmp remains and the next refresh ignores it (suffix mismatch).
  async writeFileAtomic(parent: FsDirectoryHandle, name: string, contents: string): Promise<void> {
    await this.writeAtomicViaTmp(parent, name, (w) => w.write(contents));
  }

  async writeFileAtomicBinary(
    parent: FsDirectoryHandle,
    name: string,
    data: Blob | ArrayBuffer,
  ): Promise<void> {
    await this.writeAtomicViaTmp(parent, name, (w) => w.write(data));
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
      throw this.classifyFsError(cause, { name, op: 'write' });
    }
  }

  async fileSize(parent: FsDirectoryHandle, name: string): Promise<number | null> {
    try {
      const handle = await parent.getFileHandle(name);
      const file = await handle.getFile();
      return file.size;
    } catch {
      return null;
    }
  }

  async readFile(parent: FsDirectoryHandle, name: string): Promise<File> {
    try {
      const handle = await parent.getFileHandle(name);
      return await handle.getFile();
    } catch (cause) {
      throw this.classifyFsError(cause, { name, op: 'read' });
    }
  }

  async readJson<T>(parent: FsDirectoryHandle, name: string): Promise<T> {
    try {
      const handle = await parent.getFileHandle(name);
      const file = await handle.getFile();
      const text = await file.text();
      return JSON.parse(text) as T;
    } catch (cause) {
      throw this.classifyFsError(cause, { name, op: 'read' });
    }
  }

  // why: NotAllowedError means the browser dropped readwrite permission
  //      between this call and the last successful queryPermission. Routing
  //      it to FS-004 lets the UI surface a reauthorize action instead of
  //      the generic write-failure message. SecurityError shows up the same
  //      way on some Chromium versions when the user closed the FS picker
  //      mid-request, so we treat it as a permission case too.
  private classifyFsError(cause: unknown, context: Record<string, unknown>): AppError {
    if (cause instanceof DOMException) {
      const name = cause.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        return new AppError(ERROR_CODES.FS_004, {
          severity: 'warning',
          cause,
          context,
          recoverable: true,
        });
      }
    }
    return new AppError(ERROR_CODES.FS_001, {
      severity: 'error',
      cause,
      context,
    });
  }

  async *listFiles(parent: FsDirectoryHandle, suffix?: string): AsyncIterable<string> {
    for await (const [name, entry] of parent.entries()) {
      if (entry.kind !== 'file') continue;
      if (suffix && !name.endsWith(suffix)) continue;
      yield name;
    }
  }

  async removeEntry(
    parent: FsDirectoryHandle,
    name: string,
    options: { recursive?: boolean } = {},
  ): Promise<void> {
    await parent.removeEntry(name, options);
  }

  async *listSubdirs(parent: FsDirectoryHandle): AsyncIterable<string> {
    for await (const [name, entry] of parent.entries()) {
      if (entry.kind !== 'directory') continue;
      yield name;
    }
  }

  async getDir(parent: FsDirectoryHandle, name: string): Promise<FsDirectoryHandle | null> {
    try {
      return (await parent.getDirectoryHandle(name)) as FsDirectoryHandle;
    } catch {
      return null;
    }
  }

  async moveFile(
    parent: FsDirectoryHandle,
    name: string,
    destParent: FsDirectoryHandle,
    destName?: string,
  ): Promise<void> {
    const handle = (await parent.getFileHandle(name)) as FsFileHandle;
    if (destName) await handle.move(destParent, destName);
    else await handle.move(destParent);
  }
}
