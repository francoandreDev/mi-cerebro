import type { JSONContent } from '@tiptap/core';

export const GOAL_SCHEMA_VERSION = 4;
export const GOAL_KIND = 'goal';
export const GOALS_DIR = 'goals';
export const GOAL_FILE_SUFFIX = '.json';

export type GoalPriority = 'low' | 'med' | 'high';
export const GOAL_PRIORITIES: readonly GoalPriority[] = ['low', 'med', 'high'];
export const DEFAULT_GOAL_PRIORITY: GoalPriority = 'med';

export interface Goal {
  readonly id: string;
  readonly title: string;
  readonly body: JSONContent;
  readonly tags: readonly string[];
  // why: single horizon — §13 frames goals as "tenés X tiempo para…",
  //      a single deadline. Optional because not every goal has a date.
  readonly deadline: string | null;
  readonly completed: boolean;
  // why: §13 — priority shapes star size in the constellation wall and
  //      orders triage when many goals share the same horizon.
  readonly priority: GoalPriority;
  // why: §13 — manual 0–100 progress. Invariant: completed ⇒ progress=100.
  //      Service enforces on save; migration backfills from completed.
  readonly progress: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly schemaVersion: number;
  readonly position?: string;
  readonly [key: string]: unknown;
}

export interface GoalSummary {
  readonly id: string;
  readonly title: string;
  readonly deadline: string | null;
  readonly completed: boolean;
  readonly priority: GoalPriority;
  readonly progress: number;
  readonly updatedAt: string;
  readonly tags: readonly string[];
  readonly folder: string;
  readonly position: string;
}

export const clampProgress = (n: number): number => {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n);
};

export const isGoalPriority = (v: unknown): v is GoalPriority =>
  v === 'low' || v === 'med' || v === 'high';

export const emptyDoc = (): JSONContent => ({
  type: 'doc',
  content: [{ type: 'paragraph' }],
});
