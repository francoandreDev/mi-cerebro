import type { JSONContent } from '@tiptap/core';

export const GOAL_SCHEMA_VERSION = 1;
export const GOAL_KIND = 'goal';
export const GOALS_DIR = 'goals';
export const GOAL_FILE_SUFFIX = '.json';

export interface Goal {
  readonly id: string;
  readonly title: string;
  readonly body: JSONContent;
  readonly tags: readonly string[];
  // why: single horizon — §13 frames goals as "tenés X tiempo para…",
  //      a single deadline. Optional because not every goal has a date.
  readonly deadline: string | null;
  readonly completed: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly schemaVersion: number;
  readonly [key: string]: unknown;
}

export interface GoalSummary {
  readonly id: string;
  readonly title: string;
  readonly deadline: string | null;
  readonly completed: boolean;
  readonly updatedAt: string;
  readonly tags: readonly string[];
}

export const emptyDoc = (): JSONContent => ({
  type: 'doc',
  content: [{ type: 'paragraph' }],
});
