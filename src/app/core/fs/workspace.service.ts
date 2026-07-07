import { Injectable, computed, inject, signal } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { PlatformService } from '@core/platform/platform.service';

import { CAPACITOR_WORKSPACE_ROOT, documentsRootRef } from './adapters/capacitor-native-fs';
import { FsService } from './fs.service';
import { HandleStore } from './handle-store';
import type { NativeDirRef } from './native-fs.types';
import {
  WORKSPACE_CONFIG_FILE,
  WORKSPACE_DIRS,
  WORKSPACE_MARKER,
  WORKSPACE_SCHEMA_VERSION,
  type FolderKind,
  type WorkspaceState,
} from './workspace.types';

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private readonly fs = inject(FsService);
  private readonly handles = inject(HandleStore);
  private readonly platform = inject(PlatformService);

  private readonly stateSignal = signal<WorkspaceState>('checking');
  private readonly rootSignal = signal<NativeDirRef | null>(null);
  private readonly pendingSignal = signal<NativeDirRef | null>(null);

  readonly state = this.stateSignal.asReadonly();
  readonly root = this.rootSignal.asReadonly();
  readonly pending = this.pendingSignal.asReadonly();
  readonly rootName = computed(() => this.rootSignal()?.name ?? this.pendingSignal()?.name ?? '');
  readonly isReady = computed(() => this.stateSignal() === 'ready');

  async bootstrap(): Promise<void> {
    if (!this.fs.isSupported()) {
      this.stateSignal.set('unsupported');
      return;
    }
    if (this.platform.current === 'capacitor') {
      await this.bootstrapCapacitor();
      return;
    }
    const saved = await this.handles.getRoot().catch(() => null);
    if (!saved) {
      this.stateSignal.set('needs-root');
      return;
    }
    const perm = await this.fs.queryPermission(saved).catch(() => 'denied' as const);
    if (perm === 'granted') {
      this.rootSignal.set(saved);
      this.stateSignal.set('ready');
      return;
    }
    this.rootSignal.set(saved);
    this.stateSignal.set('needs-permission');
  }

  async chooseRoot(): Promise<void> {
    const handle = await this.fs.pickDirectory();
    if (!handle) return;
    const perm = await this.fs.requestPermission(handle);
    if (perm !== 'granted') {
      throw new AppError(ERROR_CODES.FS_004, { severity: 'warning' });
    }
    const kind = await this.detectKind(handle);
    if (kind === 'foreign') {
      this.pendingSignal.set(handle);
      this.stateSignal.set('foreign-folder');
      return;
    }
    await this.adopt(handle, kind);
  }

  async confirmInitInForeign(): Promise<void> {
    const handle = this.pendingSignal();
    if (!handle) return;
    this.pendingSignal.set(null);
    await this.adopt(handle, 'foreign');
  }

  cancelForeign(): void {
    this.pendingSignal.set(null);
    this.stateSignal.set('needs-root');
  }

  async reauthorize(): Promise<void> {
    const handle = this.rootSignal();
    if (!handle) {
      this.stateSignal.set('needs-root');
      return;
    }
    const perm = await this.fs.requestPermission(handle);
    if (perm === 'granted') {
      this.stateSignal.set('ready');
      return;
    }
    throw new AppError(ERROR_CODES.FS_004, { severity: 'warning', recoverable: true });
  }

  // why: call this right before any disk write that runs inside a user
  //      gesture (button click). queryPermission can return 'granted'
  //      optimistically but the actual write still trips NotAllowedError if
  //      the browser silently downgraded the perm — requestPermission inside
  //      a gesture is the only reliable way to (re)prompt the user.
  async ensureWritable(): Promise<void> {
    const handle = this.rootSignal();
    if (!handle) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    const current = await this.fs.queryPermission(handle);
    if (current === 'granted') return;
    const requested = await this.fs.requestPermission(handle);
    if (requested !== 'granted') {
      throw new AppError(ERROR_CODES.FS_004, { severity: 'warning', recoverable: true });
    }
  }

  reset(): void {
    this.rootSignal.set(null);
    this.pendingSignal.set(null);
    this.stateSignal.set('needs-root');
    void this.handles.clearRoot();
  }

  // why: Capacitor has no folder picker and no permission-revocation model
  //      (queryPermission/requestPermission always resolve 'granted'), so
  //      'needs-root', 'needs-permission' and 'foreign-folder' are
  //      structurally unreachable here — bootstrap adopts the fixed
  //      Documents/mi-cerebro folder directly. See workspace.types.ts for
  //      the full per-platform reachability table.
  private async bootstrapCapacitor(): Promise<void> {
    const root = await this.fs.getOrCreateDir(documentsRootRef(), CAPACITOR_WORKSPACE_ROOT);
    const kind = await this.detectKind(root);
    if (kind !== 'mi-cerebro') {
      this.stateSignal.set('initializing');
      try {
        await this.initStructure(root);
      } catch (cause) {
        throw new AppError(ERROR_CODES.FS_002, { severity: 'fatal', cause });
      }
    }
    this.rootSignal.set(root);
    this.stateSignal.set('ready');
  }

  private async adopt(handle: NativeDirRef, kind: FolderKind): Promise<void> {
    if (kind !== 'mi-cerebro') {
      this.stateSignal.set('initializing');
      try {
        await this.initStructure(handle);
      } catch (cause) {
        this.stateSignal.set('needs-root');
        throw new AppError(ERROR_CODES.FS_002, { severity: 'error', cause });
      }
    }
    await this.handles.setRoot(handle);
    await this.fs.requestPersistentStorage().catch(() => false);
    this.rootSignal.set(handle);
    this.stateSignal.set('ready');
  }

  private async detectKind(handle: NativeDirRef): Promise<FolderKind> {
    if (await this.hasWorkspaceMarker(handle)) return 'mi-cerebro';
    return (await this.fs.isEmpty(handle)) ? 'empty' : 'foreign';
  }

  // why: hasEntry() only tells us the marker dir exists, not that it holds a
  //      real config file, so this checks both across every platform via
  //      NativeFs.getDir/hasEntry.
  private async hasWorkspaceMarker(handle: NativeDirRef): Promise<boolean> {
    const meta = await this.fs.getDir(handle, WORKSPACE_MARKER);
    if (!meta) return false;
    return this.fs.hasEntry(meta, WORKSPACE_CONFIG_FILE);
  }

  private async initStructure(handle: NativeDirRef): Promise<void> {
    for (const name of WORKSPACE_DIRS) {
      await this.fs.getOrCreateDir(handle, name);
    }
    const meta = await this.fs.getOrCreateDir(handle, WORKSPACE_MARKER);
    const config = {
      schemaVersion: WORKSPACE_SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
    };
    await this.fs.writeFileAtomic(meta, WORKSPACE_CONFIG_FILE, JSON.stringify(config, null, 2));
  }
}
