import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: el índice de capítulos vive en `book-open.container.ts` (la portada/
//      tapa abierta), no en el lector de capítulo — desviación del guess
//      inicial del roadmap (ver nota en roadmap-26-tutoriales.md §8.90).
export const BOOKS_CHAPTER_INDEX_TUTORIAL: TutorialDefinition = {
  id: 'books-chapter-index',
  pageId: 'books',
  labelKey: 'books.tutorial.flow.chapterIndex',
  steps: [
    {
      anchorSelector: '[data-tutorial="books-index-add"]',
      titleKey: 'books.tutorial.chapterIndex.add.title',
      bodyKey: 'books.tutorial.chapterIndex.add.body',
      action: { event: 'click', icon: 'plus' },
    },
    {
      anchorSelector: '[data-tutorial="books-index-reorder"]',
      titleKey: 'books.tutorial.chapterIndex.reorder.title',
      bodyKey: 'books.tutorial.chapterIndex.reorder.body',
      action: { event: 'click', icon: 'arrows-clockwise' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="books-index-delete"]',
      titleKey: 'books.tutorial.chapterIndex.delete.title',
      bodyKey: 'books.tutorial.chapterIndex.delete.body',
      action: { event: 'click', icon: 'x' },
      skipIfMissing: true,
    },
  ],
};

export function registerBooksChapterIndexTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(BOOKS_CHAPTER_INDEX_TUTORIAL, { autoStartIfUnseen: false });
  inject(DestroyRef).onDestroy(dispose);
}
