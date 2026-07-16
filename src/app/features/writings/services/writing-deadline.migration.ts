import type { MigrationStep } from '@core/migrations/migration.types';

// why: v3→v4 introduces `deadline` (plazo planificado, ausente hasta ahora)
//      + `reminder.enabled` (§14 extension). Ambos ausentes en escritos
//      existentes: deadline null, reminder off — opt-in only.
export const writingDeadlineMigrationStep = (from: number): MigrationStep => ({
  from,
  to: from + 1,
  run: (d) => {
    const deadline = typeof d['deadline'] === 'string' ? d['deadline'] : null;
    const existingReminder = d['reminder'];
    const reminder =
      existingReminder && typeof existingReminder === 'object' && 'enabled' in existingReminder
        ? existingReminder
        : { enabled: false };
    return { ...d, deadline, reminder, schemaVersion: from + 1 };
  },
});
