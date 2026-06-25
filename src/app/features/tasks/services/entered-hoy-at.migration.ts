import type { MigrationStep, VersionedEntity } from '@core/migrations/migration.types';

// why: v3 -> v4 introduce `enteredHoyAt` para que el jardín pueda calcular
//      marchitamiento (>3 días en HOY sin cerrar). En la migración:
//      - si la task tiene un dueDate hoy o anterior y no está cerrada, sembrar
//        con updatedAt como mejor aproximación del momento en que cayó a HOY;
//      - si no, dejar undefined (se setea al trasplantar a HOY).
//      Migración pura — el día actual se calcula con un Date que la step
//      acepta para mantenerla testeable.
export const enteredHoyAtMigrationStep = (from: number): MigrationStep => ({
  from,
  to: from + 1,
  run: (data): VersionedEntity => {
    const today = new Date().toISOString().slice(0, 10);
    const dueDates = Array.isArray(data['dueDates']) ? (data['dueDates'] as string[]) : [];
    const next = dueDates[0]?.slice(0, 10);
    const done = data['done'] === true;
    const inHoy = !done && next !== undefined && next <= today;
    const updatedAt = typeof data['updatedAt'] === 'string' ? (data['updatedAt'] as string) : null;
    const createdAt = typeof data['createdAt'] === 'string' ? (data['createdAt'] as string) : null;
    const seed = inHoy ? (updatedAt ?? createdAt ?? new Date().toISOString()) : undefined;
    return {
      ...data,
      schemaVersion: from + 1,
      ...(seed !== undefined ? { enteredHoyAt: seed } : {}),
    };
  },
});
