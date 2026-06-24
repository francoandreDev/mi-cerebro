import type { MigrationStep } from '@core/migrations/migration.types';

// why: v2→v3 introduces `nextPingAt`, the scheduler's actual firing
//      time. Legacy reminders fire exactly at `dueAt`, so backfill
//      `nextPingAt = dueAt` — the RemindersCadenceService will rewrite
//      it on the next sync tick based on the current lead-time setting.
export const reminderCadenceMigrationStep = (from: number): MigrationStep => ({
  from,
  to: from + 1,
  run: (d) => {
    const existing = typeof d['nextPingAt'] === 'string' ? d['nextPingAt'] : null;
    const due = typeof d['dueAt'] === 'string' ? d['dueAt'] : '';
    return { ...d, nextPingAt: existing ?? due, schemaVersion: from + 1 };
  },
});
