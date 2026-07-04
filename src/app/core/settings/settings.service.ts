import { Injectable, computed, effect, inject, signal } from '@angular/core';

import { FsService } from '@core/fs/fs.service';
import type { FsDirectoryHandle } from '@core/fs/fs.types';
import { WorkspaceService } from '@core/fs/workspace.service';

import {
  DEFAULT_SETTINGS,
  SETTINGS_SCHEMA_VERSION,
  SETTINGS_STORAGE_KEY,
  type BgSatLevel,
  type Settings,
  type ThemeOverride,
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

  setAutocommitMinutes(minutes: number): void {
    if (!Number.isFinite(minutes)) return;
    const clamped = Math.max(1, Math.min(180, Math.round(minutes)));
    this.update((s) => ({
      ...s,
      versioning: { ...s.versioning, autocommitMinutes: clamped },
    }));
  }

  setVariantsDormantThreshold(days: number): void {
    const clamped = Math.max(1, Math.min(365, Math.round(days)));
    this.update((s) => ({ ...s, variants: { ...s.variants, dormantThresholdDays: clamped } }));
  }

  setReminderLeadMinutes(minutes: number): void {
    if (!Number.isFinite(minutes)) return;
    // why: 2 minutes is the tightest ping in the fixed cadence; anything
    //      below would never trigger. 1 week ahead is the longest pre-set
    //      we expose, but clamp to 30 days as a sane absolute ceiling.
    const clamped = Math.max(2, Math.min(43_200, Math.round(minutes)));
    this.update((s) => ({
      ...s,
      reminders: { ...s.reminders, leadMinutes: clamped },
    }));
  }

  setPushAfterAutocommit(enabled: boolean): void {
    this.update((s) => ({
      ...s,
      versioning: { ...s.versioning, pushAfterAutocommit: enabled },
    }));
  }

  setThemeOverride(override: ThemeOverride): void {
    if (override !== 'auto' && override !== 'light' && override !== 'dark') return;
    this.update((s) => ({ ...s, theme: { ...s.theme, override } }));
  }

  setCustomBgHue(hue: number | undefined): void {
    if (hue === undefined) {
      this.update((s) => ({ ...s, theme: stripKey(s.theme, 'customBgHue') }));
      return;
    }
    const next = ((Math.round(hue) % 360) + 360) % 360;
    this.update((s) => ({ ...s, theme: { ...s.theme, customBgHue: next } }));
  }

  setCustomBgSatLevel(level: BgSatLevel | undefined): void {
    if (level === undefined) {
      this.update((s) => ({ ...s, theme: stripKey(s.theme, 'customBgSatLevel') }));
      return;
    }
    this.update((s) => ({ ...s, theme: { ...s.theme, customBgSatLevel: level } }));
  }

  setCustomAccentId(id: string | undefined): void {
    if (id === undefined) {
      this.update((s) => ({ ...s, theme: stripKey(s.theme, 'customAccentId') }));
      return;
    }
    this.update((s) => ({ ...s, theme: { ...s.theme, customAccentId: id } }));
  }

  setCompactWithRemote(enabled: boolean): void {
    this.update((s) => ({
      ...s,
      versioning: { ...s.versioning, compactWithRemote: enabled },
    }));
  }

  setPushThrottleMinutes(minutes: number): void {
    const clamped = Math.max(0, Math.min(180, Math.round(minutes)));
    this.update((s) => ({
      ...s,
      versioning: { ...s.versioning, pushThrottleMinutes: clamped },
    }));
  }

  setCompactionThresholdCommits(commits: number): void {
    if (!Number.isFinite(commits)) return;
    const clamped = Math.max(50, Math.min(10_000, Math.round(commits)));
    this.update((s) => ({
      ...s,
      versioning: { ...s.versioning, compactionThresholdCommits: clamped },
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

function stripKey<T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  const out = { ...obj };
  delete (out as Partial<T>)[key];
  return out;
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

const mergeGoals = (partial: Partial<Settings['goals']> | undefined): Settings['goals'] => {
  const base = DEFAULT_SETTINGS.goals;
  return {
    dormantThresholdDays: partial?.dormantThresholdDays ?? base.dormantThresholdDays,
  };
};

// why: back-compat — earlier settings stored the lead under
//      `goals.reminderLeadMinutes`. Read from the new path first and
//      fall back to the legacy slot so existing files don't reset.
const mergeReminders = (
  partial: Partial<Settings['reminders']> | undefined,
  legacyGoals: Partial<{ reminderLeadMinutes: number }> | undefined,
): Settings['reminders'] => {
  const base = DEFAULT_SETTINGS.reminders;
  const raw = partial?.leadMinutes ?? legacyGoals?.reminderLeadMinutes;
  const lead =
    typeof raw === 'number' && Number.isFinite(raw)
      ? Math.max(2, Math.min(43_200, Math.round(raw)))
      : base.leadMinutes;
  return { leadMinutes: lead };
};

const mergeWithDefaults = (partial: Partial<Settings>): Settings => ({
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  timezone:
    typeof partial.timezone === 'string' && isValidTimezone(partial.timezone)
      ? partial.timezone
      : DEFAULT_SETTINGS.timezone,
  versioning: { ...DEFAULT_SETTINGS.versioning, ...(partial.versioning ?? {}) },
  variants: { ...DEFAULT_SETTINGS.variants, ...(partial.variants ?? {}) },
  goals: mergeGoals(partial.goals),
  reminders: mergeReminders(
    partial.reminders,
    partial.goals as Partial<{ reminderLeadMinutes: number }> | undefined,
  ),
  theme: { ...DEFAULT_SETTINGS.theme, ...(partial.theme ?? {}) },
});
