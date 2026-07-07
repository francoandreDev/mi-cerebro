import { Injectable, inject } from '@angular/core';

import type { PermissionState } from './fs.types';
import { NATIVE_FS, type NativeFsStat } from './native-fs';
import type { NativeDirRef } from './native-fs.types';

// why: FsService stays the single DI surface every feature already injects
//      (regla §4.2.11 — toda I/O de disco pasa por acá). It now just
//      delegates to whichever NativeFs adapter DI resolves for the running
//      platform (browser today; Tauri/Capacitor from 18b/18c), so no feature
//      call site needs to change when native support lands.
@Injectable({ providedIn: 'root' })
export class FsService {
  private readonly native = inject(NATIVE_FS);

  isSupported(): boolean {
    return this.native.isSupported();
  }

  pickDirectory(): Promise<NativeDirRef | null> {
    return this.native.pickDirectory();
  }

  queryPermission(ref: NativeDirRef): Promise<PermissionState> {
    return this.native.queryPermission(ref);
  }

  requestPermission(ref: NativeDirRef): Promise<PermissionState> {
    return this.native.requestPermission(ref);
  }

  requestPersistentStorage(): Promise<boolean> {
    return this.native.requestPersistentStorage();
  }

  getOrCreateDir(parent: NativeDirRef, name: string): Promise<NativeDirRef> {
    return this.native.getOrCreateDir(parent, name);
  }

  getDir(parent: NativeDirRef, name: string): Promise<NativeDirRef | null> {
    return this.native.getDir(parent, name);
  }

  hasEntry(parent: NativeDirRef, name: string): Promise<boolean> {
    return this.native.hasEntry(parent, name);
  }

  isEmpty(ref: NativeDirRef): Promise<boolean> {
    return this.native.isEmpty(ref);
  }

  stat(parent: NativeDirRef, name: string): Promise<NativeFsStat | null> {
    return this.native.stat(parent, name);
  }

  readFile(parent: NativeDirRef, name: string): Promise<File> {
    return this.native.readFile(parent, name);
  }

  readJson<T>(parent: NativeDirRef, name: string): Promise<T> {
    return this.native.readJson(parent, name);
  }

  fileSize(parent: NativeDirRef, name: string): Promise<number | null> {
    return this.native.fileSize(parent, name);
  }

  writeFileAtomic(parent: NativeDirRef, name: string, contents: string): Promise<void> {
    return this.native.writeFileAtomic(parent, name, contents);
  }

  writeFileAtomicBinary(
    parent: NativeDirRef,
    name: string,
    data: Blob | ArrayBuffer,
  ): Promise<void> {
    return this.native.writeFileAtomicBinary(parent, name, data);
  }

  listFiles(parent: NativeDirRef, suffix?: string): AsyncIterable<string> {
    return this.native.listFiles(parent, suffix);
  }

  listSubdirs(parent: NativeDirRef): AsyncIterable<string> {
    return this.native.listSubdirs(parent);
  }

  removeEntry(
    parent: NativeDirRef,
    name: string,
    options?: { recursive?: boolean },
  ): Promise<void> {
    return this.native.removeEntry(parent, name, options);
  }

  moveFile(
    parent: NativeDirRef,
    name: string,
    destParent: NativeDirRef,
    destName?: string,
  ): Promise<void> {
    return this.native.moveFile(parent, name, destParent, destName);
  }
}
