import type { JSONContent } from '@tiptap/core';

export const LIST_SCHEMA_VERSION = 3;
export const LIST_KIND = 'list';
export const LISTS_DIR = 'lists';
export const LIST_FILE_SUFFIX = '.json';

export interface List {
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

export interface ListSummary {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
  readonly tags: readonly string[];
  readonly folder: string;
  readonly position: string;
}

export const emptyDoc = (): JSONContent => ({
  type: 'doc',
  content: [
    { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
  ],
});
