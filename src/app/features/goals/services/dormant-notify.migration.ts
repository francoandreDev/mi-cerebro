import type { MigrationStep } from '@core/migrations/migration.types';

// why: v8→v9 backfills `reminder.notifyOnDormant`, off by default — new
//      behavior on existing goals, opt-in only (§13 bans permanent/
//      unsolicited banners).
export const goalDormantNotifyMigrationStep = (from: number): MigrationStep => ({
  from,
  to: from + 1,
  run: (d) => {
    const existing = d['reminder'];
    if (existing && typeof existing === 'object' && 'notifyOnDormant' in existing) {
      return { ...d, schemaVersion: from + 1 };
    }
    const reminder = existing && typeof existing === 'object' ? existing : { enabled: false };
    return { ...d, reminder: { ...reminder, notifyOnDormant: false }, schemaVersion: from + 1 };
  },
});
