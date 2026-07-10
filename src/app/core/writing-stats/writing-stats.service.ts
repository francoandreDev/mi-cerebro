import { Injectable, effect, inject, signal } from '@angular/core';

import { FsService } from '@core/fs/fs.service';
import type { NativeDirRef } from '@core/fs/native-fs.types';
import { WorkspaceService } from '@core/fs/workspace.service';
import { SettingsService } from '@core/settings/settings.service';

import { applyWritingDelta, getDayKey } from './writing-stats.utils';
import {
  emptyWritingStats,
  WRITING_STATS_SCHEMA_VERSION,
  type WritingStats,
} from './writing-stats.types';

// why: global scope isn't tied to any one book, so it lives in the shared
//      meta dir alongside settings.json — same folder, same atomic-write
//      pattern as SettingsService.
const META_DIR = '.mi-cerebro';
const STATS_FILE = 'writing-stats.json';

@Injectable({ providedIn: 'root' })
export class WritingStatsService {
  private readonly fs = inject(FsService);
  private readonly workspace = inject(WorkspaceService);
  private readonly settings = inject(SettingsService);

  private readonly stateSignal = signal<WritingStats>(emptyWritingStats());
  readonly global = this.stateSignal.asReadonly();

  private fileSynced = false;

  constructor() {
    effect(() => {
      if (this.workspace.isReady() && !this.fileSynced) {
        this.fileSynced = true;
        void this.syncWithWorkspaceFile();
      }
    });
  }

  // why: called once per chapter save with the same word-count delta already
  //      applied to that chapter/book — no independent word-counting here.
  recordDelta(delta: number): void {
    if (delta === 0) return;
    const todayKey = getDayKey(new Date(), this.settings.timezone());
    this.stateSignal.update((s) => applyWritingDelta(s, delta, todayKey));
    void this.persistToFile();
  }

  private async persistToFile(): Promise<void> {
    const dir = await this.metaDir();
    if (!dir) return;
    try {
      await this.fs.writeFileAtomic(dir, STATS_FILE, JSON.stringify(this.stateSignal(), null, 2));
    } catch {
      // best-effort: workspace might be in a transient state.
    }
  }

  private async syncWithWorkspaceFile(): Promise<void> {
    const dir = await this.metaDir();
    if (!dir) return;
    try {
      const raw = await this.fs.readJson<Partial<WritingStats> & { schemaVersion?: number }>(
        dir,
        STATS_FILE,
      );
      if (raw.schemaVersion === WRITING_STATS_SCHEMA_VERSION) {
        this.stateSignal.set({ ...emptyWritingStats(), ...raw });
      }
    } catch {
      // file doesn't exist yet — leave the in-memory default in place.
    }
  }

  private async metaDir(): Promise<NativeDirRef | null> {
    const root = this.workspace.root();
    if (!root) return null;
    try {
      return await this.fs.getOrCreateDir(root, META_DIR);
    } catch {
      return null;
    }
  }
}
