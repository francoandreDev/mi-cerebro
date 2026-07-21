import type { MigrationStep } from '@core/migrations/migration.types';

// why: v9→v10 introduces two additive optional fields —
//      `reminderLeadMinutes` (per-goal lead-time override) and
//      `deadlineTime` (per-goal deadline hour, default 23:59). Both are
//      opt-in overrides of existing global behavior, so there's nothing to
//      backfill: absent on old goals keeps them behaving exactly as before
//      (global lead time, implicit 23:59). No-op migration, same pattern as
//      goalStepPositionsMigrationStep (v6→v7).
export const goalReminderLeadDeadlineTimeMigrationStep = (from: number): MigrationStep => ({
  from,
  to: from + 1,
  run: (d) => ({ ...d, schemaVersion: from + 1 }),
});
