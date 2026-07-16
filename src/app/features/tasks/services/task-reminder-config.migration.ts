import type { MigrationStep } from '@core/migrations/migration.types';

// why: v4→v5 backfills `reminder.enabled` on existing tasks. Unlike goals
//      (which had a random-banner precedent), tasks never had automatic
//      reminders — default OFF unconditionally, opt-in only.
export const taskReminderConfigMigrationStep = (from: number): MigrationStep => ({
  from,
  to: from + 1,
  run: (d) => {
    const existing = d['reminder'];
    if (existing && typeof existing === 'object' && 'enabled' in existing) {
      return { ...d, schemaVersion: from + 1 };
    }
    return { ...d, reminder: { enabled: false }, schemaVersion: from + 1 };
  },
});
