import { Injectable, computed, effect, inject, signal } from '@angular/core';

import { FsService } from '@core/fs/fs.service';
import type { FsDirectoryHandle } from '@core/fs/fs.types';
import { WorkspaceService } from '@core/fs/workspace.service';

import {
  DEFAULT_SETTINGS,
  SETTINGS_SCHEMA_VERSION,
  SETTINGS_STORAGE_KEY,
  type Settings,
} from './settings.types';

// why: settings live in `.mi-cerebro/` alongside trash/history so they
//      travel with the workspace folder (§1 portabilidad). localStorage
//      stays as a startup cache so the UI doesn't flicker before the
//      workspace handle is authorized.
const META_DIR = '.mi-cerebro';
const SETTINGS_FILE = 'settings.json';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly fs = inject(FsService);
  private readonly workspace = inject(WorkspaceService);

  private readonly stateSignal = signal<Settings>(this.loadFromLocalStorage());
  readonly state = this.stateSignal.asReadonly();
  readonly timezone = computed(() => this.state().timezone);

  // why: once the file has been read or seeded for this workspace, skip
  //      the effect-driven sync — further writes are pushed through `set*`.
  private fileSynced = false;

  constructor() {
    effect(() => {
      if (this.workspace.isReady() && !this.fileSynced) {
        this.fileSynced = true;
        void this.syncWithWorkspaceFile();
      }
    });
  }

  setTimezone(tz: string): void {
    if (!isValidTimezone(tz)) return;
    this.update((s) => ({ ...s, timezone: tz }));
  }

  setVariantsDormantThreshold(days: number): void {
    const clamped = Math.max(1, Math.min(365, Math.round(days)));
    this.update((s) => ({ ...s, variants: { ...s.variants, dormantThresholdDays: clamped } }));
  }

  setPushAfterAutocommit(enabled: boolean): void {
    this.update((s) => ({
      ...s,
      versioning: { ...s.versioning, pushAfterAutocommit: enabled },
    }));
  }

  setPushThrottleMinutes(minutes: number): void {
    const clamped = Math.max(0, Math.min(180, Math.round(minutes)));
    this.update((s) => ({
      ...s,
      versioning: { ...s.versioning, pushThrottleMinutes: clamped },
    }));
  }

  private update(fn: (current: Settings) => Settings): void {
    this.stateSignal.update(fn);
    this.persistToLocalStorage();
    void this.persistToFile();
  }

  private persistToLocalStorage(): void {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.stateSignal()));
    } catch {
      // localStorage may be unavailable (private mode quotas); session-only is fine.
    }
  }

  private async persistToFile(): Promise<void> {
    const dir = await this.metaDir();
    if (!dir) return;
    try {
      await this.fs.writeFileAtomic(
        dir,
        SETTINGS_FILE,
        JSON.stringify(this.stateSignal(), null, 2),
      );
    } catch {
      // best-effort: workspace might be in a transient state.
    }
  }

  private async syncWithWorkspaceFile(): Promise<void> {
    const dir = await this.metaDir();
    if (!dir) return;
    try {
      const raw = await this.fs.readJson<Partial<Settings> & { schemaVersion?: number }>(
        dir,
        SETTINGS_FILE,
      );
      if (raw.schemaVersion === SETTINGS_SCHEMA_VERSION) {
        this.stateSignal.set(mergeWithDefaults(raw));
        this.persistToLocalStorage();
        return;
      }
    } catch {
      // file doesn't exist yet — seed it from current in-memory state.
    }
    await this.persistToFile();
  }

  private async metaDir(): Promise<FsDirectoryHandle | null> {
    const root = this.workspace.root();
    if (!root) return null;
    try {
      return await this.fs.getOrCreateDir(root, META_DIR);
    } catch {
      return null;
    }
  }

  private loadFromLocalStorage(): Settings {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return DEFAULT_SETTINGS;
      const parsed = JSON.parse(raw) as Partial<Settings> & { schemaVersion?: number };
      if (parsed.schemaVersion !== SETTINGS_SCHEMA_VERSION) return DEFAULT_SETTINGS;
      return mergeWithDefaults(parsed);
    } catch {
      return DEFAULT_SETTINGS;
    }
  }
}

export const isValidTimezone = (tz: string): boolean => {
  if (typeof tz !== 'string' || tz === '') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const mergeWithDefaults = (partial: Partial<Settings>): Settings => ({
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  timezone:
    typeof partial.timezone === 'string' && isValidTimezone(partial.timezone)
      ? partial.timezone
      : DEFAULT_SETTINGS.timezone,
  versioning: { ...DEFAULT_SETTINGS.versioning, ...(partial.versioning ?? {}) },
  variants: { ...DEFAULT_SETTINGS.variants, ...(partial.variants ?? {}) },
  goals: { ...DEFAULT_SETTINGS.goals, ...(partial.goals ?? {}) },
  theme: { ...DEFAULT_SETTINGS.theme, ...(partial.theme ?? {}) },
});
