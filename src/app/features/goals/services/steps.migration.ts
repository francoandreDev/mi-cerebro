import type { MigrationStep } from '@core/migrations/migration.types';

// why: v5→v6 introduce sub-pasos por meta. Goals viejos no tienen `steps`;
//      se sembra arreglo vacío y la UI sigue mostrando progress manual
//      hasta que el usuario agregue su primer paso.
export const goalStepsMigrationStep = (from: number): MigrationStep => ({
  from,
  to: from + 1,
  run: (d) => {
    const existing = d['steps'];
    const steps = Array.isArray(existing) ? existing : [];
    return { ...d, steps, schemaVersion: from + 1 };
  },
});
