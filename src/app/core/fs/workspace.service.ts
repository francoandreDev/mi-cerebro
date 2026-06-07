import { Injectable, computed, inject, signal } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';

import { FsService } from './fs.service';
import { HandleStore } from './handle-store';
import type { FsDirectoryHandle } from './fs.types';
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

  private readonly stateSignal = signal<WorkspaceState>('checking');
  private readonly rootSignal = signal<FsDirectoryHandle | null>(null);
  private readonly pendingSignal = signal<FsDirectoryHandle | null>(null);

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
    }
  }

  reset(): void {
    this.rootSignal.set(null);
    this.pendingSignal.set(null);
    this.stateSignal.set('needs-root');
    void this.handles.clearRoot();
  }

  private async adopt(handle: FsDirectoryHandle, kind: FolderKind): Promise<void> {
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

  private async detectKind(handle: FsDirectoryHandle): Promise<FolderKind> {
    if (await this.hasWorkspaceMarker(handle)) return 'mi-cerebro';
    return (await this.fs.isEmpty(handle)) ? 'empty' : 'foreign';
  }

  private async hasWorkspaceMarker(handle: FsDirectoryHandle): Promise<boolean> {
    try {
      const meta = (await handle.getDirectoryHandle(WORKSPACE_MARKER)) as FsDirectoryHandle;
      await meta.getFileHandle(WORKSPACE_CONFIG_FILE);
      return true;
    } catch {
      return false;
    }
  }

  private async initStructure(handle: FsDirectoryHandle): Promise<void> {
    for (const name of WORKSPACE_DIRS) {
      await this.fs.getOrCreateDir(handle, name);
    }
    const meta = (await handle.getDirectoryHandle(WORKSPACE_MARKER)) as FsDirectoryHandle;
    const file = await this.fs.getOrCreateFile(meta, WORKSPACE_CONFIG_FILE);
    const writer = await file.createWritable();
    const config = {
      schemaVersion: WORKSPACE_SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
    };
    await writer.write(JSON.stringify(config, null, 2));
    await writer.close();
  }
}
