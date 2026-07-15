import type { JSONContent } from '@tiptap/core';

import type { WritingStats } from '@core/writing-stats/writing-stats.types';

export const BOOK_SCHEMA_VERSION = 5;
export const CHAPTER_SCHEMA_VERSION = 5;
export const BOOK_KIND = 'book';
export const BOOKS_DIR = 'books';
export const BOOK_META_FILE = '_book.json';
export const CHAPTERS_DIR = 'chapters';
export const CHAPTER_FILE_SUFFIX = '.json';

// why: por defecto portada/reverso son procedurales (gradiente derivado del
//      hash del id + título). En el futuro el usuario podrá subir imágenes
//      propias (kind: 'image' con ref al blob en disco); el override está en
//      docs/deferred/index.md.
export type BookFaceRef =
  | { readonly kind: 'auto' }
  | { readonly kind: 'image'; readonly file: string };

export interface BookBookmark {
  readonly chapterId: string;
  readonly blockId: string;
}

export interface Book {
  readonly id: string;
  readonly title: string;
  readonly tags: readonly string[];
  readonly order: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly schemaVersion: number;
  readonly position?: string;
  readonly cover?: BookFaceRef;
  readonly back?: BookFaceRef;
  readonly accent?: string;
  readonly subtitle?: string;
  // why: sinopsis breve de la contratapa (texto plano, no rich text — es una
  //      ficha de ~100-200 palabras, no un capítulo). Reemplaza a backNote
  //      como contenido de la cara trasera del libro cerrado.
  readonly synopsis?: string;
  // why: contenido del viejo "reverso" libre. Ya no se lee/escribe desde la
  //      UI (reemplazado por synopsis + bio de autor), pero se deja el campo
  //      para no perder silenciosamente contenido ya guardado en libros
  //      existentes.
  readonly backNote?: JSONContent;
  // why: marcador manual (no automático) sobre un párrafo exacto — el
  //      usuario elige explícitamente qué bloque marcar para volver directo
  //      ahí, como un separador real. chapterId ubica el capítulo; blockId
  //      es el id estable del párrafo/heading dentro de ese capítulo (ver
  //      core/tiptap/block-id). `| undefined` explícito (no sólo `?`) porque
  //      togglear el marcador necesita poder limpiarlo, y
  //      `exactOptionalPropertyTypes` distingue "ausente" de "presente pero
  //      undefined".
  readonly bookmark?: BookBookmark | undefined;
  readonly stats?: WritingStats;
  readonly [key: string]: unknown;
}

export type ChapterImageRef =
  | { readonly kind: 'auto' }
  | { readonly kind: 'image'; readonly file: string };

export interface Chapter {
  readonly id: string;
  readonly bookId: string;
  readonly title: string;
  readonly body: JSONContent;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly schemaVersion: number;
  // why: pageCount lo persiste el editor al guardar (totalSpreads*2). Falta
  //      cuando el capítulo nunca se abrió: cae a una estimación palabras/250.
  readonly pageCount?: number;
  readonly image?: ChapterImageRef;
  // why: last persisted word count, so saveChapter can derive today's delta
  //      without re-summing anything (see WritingStatsService).
  readonly words?: number;
  readonly stats?: WritingStats;
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
  readonly pageCount: number;
  readonly pageStart: number;
  readonly pageEnd: number;
  readonly image: ChapterImageRef;
}

export interface BookSummary {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
  readonly tags: readonly string[];
  readonly folder: string;
  readonly chapterCount: number;
  readonly position: string;
  readonly cover: BookFaceRef;
  readonly back: BookFaceRef;
  readonly accent: string | null;
  readonly subtitle: string;
}

export interface BookBundle {
  readonly book: Book;
  readonly chapters: readonly Chapter[];
}

export const emptyChapterDoc = (): JSONContent => ({
  type: 'doc',
  content: [{ type: 'paragraph' }],
});
