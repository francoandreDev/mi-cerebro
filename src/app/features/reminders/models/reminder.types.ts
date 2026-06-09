export const REMINDER_SCHEMA_VERSION = 1;
export const REMINDER_KIND = 'reminder';
export const REMINDERS_DIR = 'reminders';
export const REMINDER_FILE_SUFFIX = '.json';

export interface Reminder {
  readonly id: string;
  readonly title: string;
  // why: ISO 8601 local-time (e.g. 2026-06-15T09:30) without timezone —
  //      reminders only fire while the app is open, so they live in the
  //      user's wall-clock and we don't need to chase timezone math.
  readonly dueAt: string;
  readonly done: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly schemaVersion: number;
  readonly [key: string]: unknown;
}

export interface ReminderSummary {
  readonly id: string;
  readonly title: string;
  readonly dueAt: string;
  readonly done: boolean;
  readonly updatedAt: string;
}
