import type { JSONContent } from '@tiptap/core';

export const TASK_SCHEMA_VERSION = 2;
export const TASK_KIND = 'task';
export const TASKS_DIR = 'tasks';
export const TASK_FILE_SUFFIX = '.json';

export interface Task {
  readonly id: string;
  readonly title: string;
  readonly body: JSONContent;
  readonly tags: readonly string[];
  readonly done: boolean;
  // why: array (not single field) because §3 says tareas tienen 'fecha(s)' —
  //      a single task may have multiple deadlines/check-ins. Stored as ISO
  //      strings, kept sorted ascending so the next-due is always at [0].
  readonly dueDates: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly schemaVersion: number;
  readonly [key: string]: unknown;
}

export interface TaskSummary {
  readonly id: string;
  readonly title: string;
  readonly done: boolean;
  readonly dueDates: readonly string[];
  readonly updatedAt: string;
  readonly tags: readonly string[];
  readonly folder: string;
}

export const emptyDoc = (): JSONContent => ({
  type: 'doc',
  content: [{ type: 'paragraph' }],
});

export const sortDueDates = (dates: readonly string[]): readonly string[] =>
  [...dates].sort((a, b) => a.localeCompare(b));
