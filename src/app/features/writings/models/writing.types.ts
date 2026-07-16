import type { JSONContent } from '@tiptap/core';

export const WRITING_SCHEMA_VERSION = 4;
export const WRITING_KIND = 'writing';
export const WRITINGS_DIR = 'writings';
export const WRITING_FILE_SUFFIX = '.json';

export interface Writing {
  readonly id: string;
  readonly title: string;
  readonly body: JSONContent;
  readonly tags: readonly string[];
  // why: §14 extension — plazo planificado opcional. Date-only (YYYY-MM-DD),
  //      tratado como fin del día, mismo criterio que Goal.deadline.
  readonly deadline: string | null;
  // why: §14 extension — auto-genera un Reminder cuando hay deadline, mismo
  //      patrón de ciclo de vida que GoalRemindersSyncService. Opt-in, off
  //      por default.
  readonly reminder: WritingReminderConfig;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly schemaVersion: number;
  readonly position?: string;
  readonly [key: string]: unknown;
}

export interface WritingReminderConfig {
  readonly enabled: boolean;
}

export const DEFAULT_WRITING_REMINDER: WritingReminderConfig = { enabled: false };

export interface WritingSummary {
  readonly id: string;
  readonly title: string;
  readonly deadline: string | null;
  readonly reminder: WritingReminderConfig;
  readonly updatedAt: string;
  readonly tags: readonly string[];
  readonly folder: string;
  readonly position: string;
  readonly preview: string;
  readonly wordCount: number;
}

export const emptyDoc = (): JSONContent => ({
  type: 'doc',
  content: [{ type: 'paragraph' }],
});
