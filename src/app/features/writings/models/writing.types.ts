import type { JSONContent } from '@tiptap/core';

export const WRITING_SCHEMA_VERSION = 3;
export const WRITING_KIND = 'writing';
export const WRITINGS_DIR = 'writings';
export const WRITING_FILE_SUFFIX = '.json';

export interface Writing {
  readonly id: string;
  readonly title: string;
  readonly body: JSONContent;
  readonly tags: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly schemaVersion: number;
  readonly position?: string;
  readonly [key: string]: unknown;
}

export interface WritingSummary {
  readonly id: string;
  readonly title: string;
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
