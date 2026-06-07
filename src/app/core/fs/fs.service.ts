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

  // why: write to <name>.tmp then atomic-rename over <name>. If JSON.stringify
  //      or the write fails mid-flight, the original file is untouched.
  async writeFileAtomic(parent: FsDirectoryHandle, name: string, contents: string): Promise<void> {
    const tmpName = `${name}.tmp`;
    try {
      const tmp = (await parent.getFileHandle(tmpName, { create: true })) as FsFileHandle;
      const writable = await tmp.createWritable({ keepExistingData: false });
      await writable.write(contents);
      await writable.close();
      await tmp.move(name);
    } catch (cause) {
      // best-effort cleanup of the leftover .tmp; ignore secondary failures.
      try {
        await parent.removeEntry(tmpName);
      } catch {
        /* noop */
      }
      throw new AppError(ERROR_CODES.FS_001, {
        severity: 'error',
        cause,
        context: { name },
      });
    }
  }

  async readJson<T>(parent: FsDirectoryHandle, name: string): Promise<T> {
    try {
      const handle = await parent.getFileHandle(name);
      const file = await handle.getFile();
      const text = await file.text();
      return JSON.parse(text) as T;
    } catch (cause) {
      throw new AppError(ERROR_CODES.FS_001, {
        severity: 'error',
        cause,
        context: { name, op: 'read' },
      });
    }
  }

  async *listFiles(parent: FsDirectoryHandle, suffix?: string): AsyncIterable<string> {
    for await (const [name, entry] of parent.entries()) {
      if (entry.kind !== 'file') continue;
      if (suffix && !name.endsWith(suffix)) continue;
      yield name;
    }
  }

  async removeEntry(parent: FsDirectoryHandle, name: string): Promise<void> {
    await parent.removeEntry(name);
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
