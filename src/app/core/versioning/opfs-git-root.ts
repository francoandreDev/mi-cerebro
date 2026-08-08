// docs/deferred/versionado.md — `.git/` on OPFS. BrowserNativeFs turns out
// to be directly reusable for the OPFS side: it only ever calls the
// standard FileSystemDirectoryHandle/FileSystemFileHandle surface
// (getDirectoryHandle, getFileHandle, entries(), createWritable(), .move()),
// which navigator.storage.getDirectory()'s root handle implements too. The
// one gap is queryPermission/requestPermission — OPFS handles don't have
// them (no permission prompt model applies to a private origin store), but
// none of the git-relevant NativeFs methods call those, only the
// FS-Access-API workspace-picker codepath does.

import { Injectable, inject } from '@angular/core';

import { PlatformService } from '@core/platform/platform.service';

import { BrowserNativeFs } from '../fs/adapters/browser-native-fs';
import type { FsDirectoryHandle } from '../fs/fs.types';
import type { NativeDirRef } from '../fs/native-fs.types';

@Injectable({ providedIn: 'root' })
export class OpfsGitRootService {
  private readonly platform = inject(PlatformService);
  private readonly browserFs = inject(BrowserNativeFs);
  private gitDirPromise: Promise<NativeDirRef> | null = null;

  // why: only the browser platform lacks a fast native FS — Tauri/
  //      Capacitor already read/write the real filesystem directly, OPFS
  //      would add a second storage location for zero gain there.
  isAvailable(): boolean {
    return (
      this.platform.current === 'browser' &&
      typeof navigator !== 'undefined' &&
      typeof navigator.storage?.getDirectory === 'function'
    );
  }

  // Memoized: OPFS root lookup + `.git` getOrCreateDir is cheap but there's
  // no reason to repeat it per git.* call within a session.
  async getGitDir(): Promise<NativeDirRef | null> {
    if (!this.isAvailable()) return null;
    if (!this.gitDirPromise) {
      this.gitDirPromise = this.resolveGitDir().catch((e) => {
        this.gitDirPromise = null;
        throw e;
      });
    }
    return this.gitDirPromise;
  }

  resetForNewWorkspace(): void {
    this.gitDirPromise = null;
  }

  // Unmemoized sibling of getGitDir() for DevPerfService's OPFS-vs-real-FS
  // benchmark — a throwaway scratch dir, never the production `.git`, so
  // it deliberately doesn't share (or pollute) the cached gitDirPromise.
  async getScratchDir(name: string): Promise<NativeDirRef | null> {
    if (!this.isAvailable()) return null;
    const opfsRoot = await navigator.storage.getDirectory();
    return this.browserFs.getOrCreateDir(opfsRoot as unknown as FsDirectoryHandle, name);
  }

  private async resolveGitDir(): Promise<NativeDirRef> {
    const opfsRoot = await navigator.storage.getDirectory();
    return this.browserFs.getOrCreateDir(opfsRoot as unknown as FsDirectoryHandle, '.git');
  }
}
