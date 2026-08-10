import type { MigrationStep } from '@core/migrations/migration.types';

// why: v5→v6 adds `note: string` (docs/deferred/reminders-goals.md
//      "ronroneo"). Legacy reminders default to an empty note; the hover
//      preview falls back to the title when it's empty, so behavior is
//      identical until the user writes one.
export const reminderNoteMigrationStep = (from: number): MigrationStep => ({
  from,
  to: from + 1,
  run: (d) => ({
    ...d,
    note: typeof d['note'] === 'string' ? d['note'] : '',
    schemaVersion: from + 1,
  }),
});
