import type { MigrationStep } from '@core/migrations/migration.types';

// why: v7→v8 backfills `lastProgressAt` for existing goals. `updatedAt` is
//      the only signal we have retroactively (we don't know if past edits
//      touched progress specifically) — best-effort baseline so goals don't
//      all appear dormant the instant this ships.
export const goalProgressActivityMigrationStep = (from: number): MigrationStep => ({
  from,
  to: from + 1,
  run: (d) => {
    if (typeof d['lastProgressAt'] === 'string') return { ...d, schemaVersion: from + 1 };
    const updatedAt =
      typeof d['updatedAt'] === 'string' ? d['updatedAt'] : new Date().toISOString();
    return { ...d, lastProgressAt: updatedAt, schemaVersion: from + 1 };
  },
});
