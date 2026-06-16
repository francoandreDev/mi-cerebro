import type { MigrationStep } from '@core/migrations/migration.types';

// why: per-entity step that only bumps schemaVersion. The actual position
//      seeding is a collection-level operation (needs the full sort order),
//      and runs in each *Service.refresh() via `seedMissingPositions`. The
//      schema bump exists so that MigrationsService backs up the workspace
//      once per kind (§4.15.31) before the seeding pass starts writing
//      `position` back into each file.
export const positionSeedMigrationStep = (from: number): MigrationStep => ({
  from,
  to: from + 1,
  run: (d) => ({ ...d, schemaVersion: from + 1 }),
});
