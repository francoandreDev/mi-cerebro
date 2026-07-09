import type { MigrationStep } from '@core/migrations/migration.types';

// why: v3→v4 just bumps schemaVersion. The new optional `scheduledFor`
//      field defaults to undefined for legacy notes (= "not on the
//      calendar"), so no field needs to be backfilled.
export const scheduledForMigrationStep = (from: number): MigrationStep => ({
  from,
  to: from + 1,
  run: (d) => ({ ...d, schemaVersion: from + 1 }),
});
