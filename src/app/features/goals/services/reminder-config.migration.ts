import type { MigrationStep } from '@core/migrations/migration.types';

// why: v4→v5 backfills `reminder.enabled` on existing goals. Default ON
//      when there's a deadline and the goal isn't done — those are the
//      ones the previous random-banner system would have nudged anyway.
//      Without deadline or already completed: OFF.
export const goalReminderConfigMigrationStep = (from: number): MigrationStep => ({
  from,
  to: from + 1,
  run: (d) => {
    const existing = d['reminder'];
    if (existing && typeof existing === 'object' && 'enabled' in existing) {
      return { ...d, schemaVersion: from + 1 };
    }
    const deadline = typeof d['deadline'] === 'string' ? d['deadline'] : null;
    const completed = d['completed'] === true;
    const enabled = deadline !== null && !completed;
    return { ...d, reminder: { enabled }, schemaVersion: from + 1 };
  },
});
