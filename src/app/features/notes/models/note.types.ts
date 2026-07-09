import type { JSONContent } from '@tiptap/core';

export const NOTE_SCHEMA_VERSION = 4;
export const NOTE_KIND = 'note';
export const NOTES_DIR = 'notes';
export const NOTE_FILE_SUFFIX = '.json';

export interface Note {
  readonly id: string;
  readonly title: string;
  readonly body: JSONContent;
  readonly tags: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly schemaVersion: number;
  readonly position?: string;
  // why: opt-in date the user assigns explicitly so the note can surface in
  //      /calendar (§ redesign v2). Absent/null means "no date" — never
  //      inferred from createdAt/updatedAt, which would misrepresent it.
  readonly scheduledFor?: string | null;
  readonly [key: string]: unknown;
}

export interface NoteSummary {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
  readonly tags: readonly string[];
  readonly folder: string;
  readonly position: string;
  readonly preview: string;
  readonly scheduledFor: string | null;
}

export const emptyDoc = (): JSONContent => ({
  type: 'doc',
  content: [{ type: 'paragraph' }],
});
