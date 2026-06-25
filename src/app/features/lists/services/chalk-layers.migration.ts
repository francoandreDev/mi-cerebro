import type { MigrationStep } from '@core/migrations/migration.types';

// why: v3→v4 introduces the chalkboard overlay (named `chalkLayers`) on every
//      list. The default is an empty array — no strokes — so existing lists
//      keep rendering exactly the same until the user enables chalk mode.
export const chalkLayersMigrationStep = (from: number): MigrationStep => ({
  from,
  to: from + 1,
  run: (d) => ({ ...d, chalkLayers: [], schemaVersion: from + 1 }),
});
