import type { MigrationStep } from '@core/migrations/migration.types';

// why: v1→v2 just bumps schemaVersion. The new optional `sourceKind` /
//      `sourceId` fields default to undefined for legacy files (= "user
//      created"), so no field needs to be backfilled.
export const reminderSourceMigrationStep = (from: number): MigrationStep => ({
  from,
  to: from + 1,
  run: (d) => ({ ...d, schemaVersion: from + 1 }),
});
