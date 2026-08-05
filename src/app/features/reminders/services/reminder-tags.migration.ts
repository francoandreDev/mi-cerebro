import type { MigrationStep } from '@core/migrations/migration.types';

// why: v4→v5 adds `tags: readonly string[]` (docs/deferred/reminders-goals.md
//      "Palomares temáticos por categoría"). Legacy reminders default to
//      untagged; behavior identical to before until the user tags one.
export const reminderTagsMigrationStep = (from: number): MigrationStep => ({
  from,
  to: from + 1,
  run: (d) => ({
    ...d,
    tags: Array.isArray(d['tags']) ? d['tags'] : [],
    schemaVersion: from + 1,
  }),
});
