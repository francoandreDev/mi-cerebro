import type { JSONContent } from '@tiptap/core';

export const NOTE_SCHEMA_VERSION = 1;
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
  readonly [key: string]: unknown;
}

export interface NoteSummary {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
  readonly tags: readonly string[];
}

export const emptyDoc = (): JSONContent => ({
  type: 'doc',
  content: [{ type: 'paragraph' }],
});
