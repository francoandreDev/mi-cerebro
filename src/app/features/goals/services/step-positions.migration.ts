import type { MigrationStep } from '@core/migrations/migration.types';

// why: v6→v7 introduce x/y opcionales por step. Migración no-op: los steps
//      viejos quedan sin coordenadas y el renderer cae a fallback hash-based
//      hasta que el usuario reposicione o cree pasos nuevos clickeando.
export const goalStepPositionsMigrationStep = (from: number): MigrationStep => ({
  from,
  to: from + 1,
  run: (d) => ({ ...d, schemaVersion: from + 1 }),
});
