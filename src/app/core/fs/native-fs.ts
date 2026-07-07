import { InjectionToken } from '@angular/core';

import type { PermissionState } from './fs.types';
import type { NativeDirRef } from './native-fs.types';

// why: platform-agnostic surface every adapter (browser today; Tauri/
//      Capacitor in 18b/18c) implements. FsService becomes a thin delegate
//      over whichever adapter DI resolves (see native-fs.providers.ts).
// why: git-fs.adapter needs to tell file/dir apart and get ENOENT vs ENOTDIR
//      right without inspecting platform-specific exceptions (DOMException on
//      browser, tauri/capacitor plugin errors elsewhere) — a single stat
//      shape normalizes that across all three adapters.
export interface NativeFsStat {
  readonly kind: 'file' | 'dir';
  readonly size: number;
  readonly mtimeMs: number;
}

export interface NativeFs {
  isSupported(): boolean;

  pickDirectory(): Promise<NativeDirRef | null>;
  queryPermission(ref: NativeDirRef): Promise<PermissionState>;
  requestPermission(ref: NativeDirRef): Promise<PermissionState>;
  requestPersistentStorage(): Promise<boolean>;

  getOrCreateDir(parent: NativeDirRef, name: string): Promise<NativeDirRef>;
  getDir(parent: NativeDirRef, name: string): Promise<NativeDirRef | null>;
  hasEntry(parent: NativeDirRef, name: string): Promise<boolean>;
  isEmpty(ref: NativeDirRef): Promise<boolean>;
  stat(parent: NativeDirRef, name: string): Promise<NativeFsStat | null>;

  readFile(parent: NativeDirRef, name: string): Promise<File>;
  readJson<T>(parent: NativeDirRef, name: string): Promise<T>;
  fileSize(parent: NativeDirRef, name: string): Promise<number | null>;
  writeFileAtomic(parent: NativeDirRef, name: string, contents: string): Promise<void>;
  writeFileAtomicBinary(
    parent: NativeDirRef,
    name: string,
    data: Blob | ArrayBuffer,
  ): Promise<void>;

  listFiles(parent: NativeDirRef, suffix?: string): AsyncIterable<string>;
  listSubdirs(parent: NativeDirRef): AsyncIterable<string>;

  removeEntry(parent: NativeDirRef, name: string, options?: { recursive?: boolean }): Promise<void>;
  moveFile(
    parent: NativeDirRef,
    name: string,
    destParent: NativeDirRef,
    destName?: string,
  ): Promise<void>;
}

export const NATIVE_FS = new InjectionToken<NativeFs>('NATIVE_FS');
