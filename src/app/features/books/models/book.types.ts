import type { JSONContent } from '@tiptap/core';

export const BOOK_SCHEMA_VERSION = 3;
export const CHAPTER_SCHEMA_VERSION = 2;
export const BOOK_KIND = 'book';
export const BOOKS_DIR = 'books';
export const BOOK_META_FILE = '_book.json';
export const CHAPTERS_DIR = 'chapters';
export const CHAPTER_FILE_SUFFIX = '.json';

export interface Book {
  readonly id: string;
  readonly title: string;
  readonly tags: readonly string[];
  readonly order: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly schemaVersion: number;
  readonly position?: string;
  readonly [key: string]: unknown;
}

export interface Chapter {
  readonly id: string;
  readonly bookId: string;
  readonly title: string;
  readonly body: JSONContent;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly schemaVersion: number;
  readonly [key: string]: unknown;
}

export interface ChapterPreview {
  readonly head: string;
  readonly tail: string;
}

export interface ChapterSummary {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
  readonly words: number;
  readonly preview: ChapterPreview;
}

export interface BookSummary {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
  readonly tags: readonly string[];
  readonly folder: string;
  readonly chapterCount: number;
  readonly position: string;
}

export interface BookBundle {
  readonly book: Book;
  readonly chapters: readonly Chapter[];
}

export const emptyChapterDoc = (): JSONContent => ({
  type: 'doc',
  content: [{ type: 'paragraph' }],
});
