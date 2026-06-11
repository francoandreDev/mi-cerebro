export const SETTINGS_SCHEMA_VERSION = 1;
export const SETTINGS_STORAGE_KEY = 'mc.settings.v1';

export type ThemeOverride = 'auto' | 'light' | 'dark';

export interface Settings {
  readonly schemaVersion: number;
  readonly timezone: string;
  readonly versioning: {
    readonly autocommitMinutes: number;
    readonly pushAfterAutocommit: boolean;
    readonly pushThrottleMinutes: number;
  };
  readonly variants: {
    readonly dormantThresholdDays: number;
  };
  readonly goals: {
    readonly dormantThresholdDays: number;
  };
  readonly theme: {
    readonly override: ThemeOverride;
  };
}

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  timezone: 'America/Lima',
  versioning: {
    autocommitMinutes: 5,
    pushAfterAutocommit: false,
    pushThrottleMinutes: 5,
  },
  variants: { dormantThresholdDays: 30 },
  goals: { dormantThresholdDays: 30 },
  theme: { override: 'auto' },
};
