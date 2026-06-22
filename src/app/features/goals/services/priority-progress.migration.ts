import type { MigrationStep } from '@core/migrations/migration.types';

import { DEFAULT_GOAL_PRIORITY, clampProgress, isGoalPriority } from '../models/goal.types';

// why: v3→v4 backfills priority/progress on existing goals. Missing priority
//      defaults to 'med'; missing progress derives from completed (100 if
//      done, 0 otherwise) so users don't see a fresh "0%" on goals they
//      already finished.
export const goalPriorityProgressMigrationStep = (from: number): MigrationStep => ({
  from,
  to: from + 1,
  run: (d) => {
    const priority = isGoalPriority(d['priority']) ? d['priority'] : DEFAULT_GOAL_PRIORITY;
    const completed = d['completed'] === true;
    const rawProgress = d['progress'];
    const progress =
      typeof rawProgress === 'number' ? clampProgress(rawProgress) : completed ? 100 : 0;
    return { ...d, priority, progress, schemaVersion: from + 1 };
  },
});
