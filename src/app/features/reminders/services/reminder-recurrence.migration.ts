import type { MigrationStep } from '@core/migrations/migration.types';

// why: v3→v4 adds `paused: boolean` and `recurrence: Recurrence | null`
//      to support the palomar redesign (palomas dormidas + anillo de
//      colores). Legacy reminders default to paused=false and one-shot
//      (recurrence=null); behavior identical to before until the user
//      opts into either field.
export const reminderRecurrenceMigrationStep = (from: number): MigrationStep => ({
  from,
  to: from + 1,
  run: (d) => ({
    ...d,
    paused: typeof d['paused'] === 'boolean' ? d['paused'] : false,
    recurrence: d['recurrence'] ?? null,
    schemaVersion: from + 1,
  }),
});
