export const SETTINGS_SCHEMA_VERSION = 1;
export const SETTINGS_STORAGE_KEY = 'mc.settings.v1';

export type ThemeOverride = 'auto' | 'light' | 'dark';

export interface Settings {
  readonly schemaVersion: number;
  readonly timezone: string;
  // why: bio de autor global — se escribe una vez en Ajustes y se reusa en
  //      la contratapa de todos los libros (no es un campo por libro).
  readonly authorBio: string;
  readonly versioning: {
    readonly autocommitMinutes: number;
    readonly pushAfterAutocommit: boolean;
    readonly pushThrottleMinutes: number;
    readonly compactWithRemote: boolean;
    readonly compactionThresholdCommits: number;
  };
  readonly variants: {
    readonly dormantThresholdDays: number;
  };
  readonly goals: {
    readonly dormantThresholdDays: number;
  };
  readonly reminders: {
    // why: how many minutes before the target the reminder ping-series
    //      starts (applies to every reminder, goal-derived or manual).
    //      The cadence itself is fixed (a sequence of ever-tighter pings
    //      down to the target + a couple after); the user only chooses
    //      how far in advance to start being nudged.
    readonly leadMinutes: number;
  };
  readonly theme: {
    readonly override: ThemeOverride;
    readonly customBgHue?: number;
    readonly customBgSatLevel?: BgSatLevel;
    readonly customAccentId?: string;
  };
  readonly sync: {
    // why: silbido al despachar una cápsula en /sync (docs/deferred/sync.md).
    readonly muted: boolean;
  };
}

export type BgSatLevel = 'low' | 'mid' | 'high';

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  timezone: 'America/Lima',
  authorBio: '',
  versioning: {
    autocommitMinutes: 5,
    pushAfterAutocommit: false,
    pushThrottleMinutes: 5,
    compactWithRemote: false,
    compactionThresholdCommits: 500,
  },
  variants: { dormantThresholdDays: 30 },
  goals: { dormantThresholdDays: 30 },
  reminders: { leadMinutes: 1440 },
  theme: { override: 'auto' },
  sync: { muted: false },
};
