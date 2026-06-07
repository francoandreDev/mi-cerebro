import { Injectable } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';

import type { FsDirectoryHandle, PermissionState } from './fs.types';

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
}
