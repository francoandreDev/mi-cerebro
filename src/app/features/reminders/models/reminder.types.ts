export const REMINDER_SCHEMA_VERSION = 3;
export const REMINDER_KIND = 'reminder';
export const REMINDERS_DIR = 'reminders';
export const REMINDER_FILE_SUFFIX = '.json';

// why: §14 unification — reminders may be created by the user (no source)
//      or auto-derived from another entity (currently only goals). The
//      source link is what lets the toast open the right detail page and
//      what lets "delete" disable the toggle on the goal instead of being
//      re-created next sync tick.
export type ReminderSourceKind = 'goal';

export interface Reminder {
  readonly id: string;
  readonly title: string;
  // why: ISO 8601 local-time (e.g. 2026-06-15T09:30) without timezone —
  //      reminders only fire while the app is open, so they live in the
  //      user's wall-clock and we don't need to chase timezone math.
  //      `dueAt` is the user-facing target ("when's the event"); the
  //      scheduler actually fires at `nextPingAt`, which the cadence
  //      service advances through the lead-up series until exhausted.
  readonly dueAt: string;
  readonly nextPingAt: string;
  readonly done: boolean;
  readonly sourceKind?: ReminderSourceKind | null;
  readonly sourceId?: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly schemaVersion: number;
  readonly [key: string]: unknown;
}

export interface ReminderSummary {
  readonly id: string;
  readonly title: string;
  readonly dueAt: string;
  readonly nextPingAt: string;
  readonly done: boolean;
  readonly sourceKind: ReminderSourceKind | null;
  readonly sourceId: string | null;
  readonly updatedAt: string;
}
