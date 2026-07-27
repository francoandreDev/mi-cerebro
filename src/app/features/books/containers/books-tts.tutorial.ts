import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: el bookmark del editor es un pin que aparece al pasar el mouse
//      sobre CUALQUIER párrafo (`bookmark-pin.ext.ts`, TipTap decoration)
//      — no hay "el" bloque correcto para practicar el gesto, así que va
//      como mención de existencia sin `action` (§8.85 2b), anclada al
//      pane del editor (ya usado por el flujo `books`).
export const BOOKS_TTS_TUTORIAL: TutorialDefinition = {
  id: 'books-tts',
  pageId: 'books',
  labelKey: 'books.tutorial.flow.tts',
  steps: [
    {
      anchorSelector: '[data-tutorial="books-editor-tts"]',
      titleKey: 'books.tutorial.tts.toggle.title',
      bodyKey: 'books.tutorial.tts.toggle.body',
      action: { event: 'keydown', key: 'r', ctrlOrMeta: true, altKey: true, icon: 'play' },
    },
    {
      anchorSelector: '[data-tutorial="books-editor-tts"]',
      titleKey: 'books.tutorial.tts.controls.title',
      bodyKey: 'books.tutorial.tts.controls.body',
      action: { event: 'click', icon: 'faders-horizontal' },
      moreDetail: { bodyKey: 'books.tutorial.tts.controls.moreDetail' },
    },
    {
      anchorSelector: '[data-tutorial="books-reader-pane"]',
      titleKey: 'books.tutorial.tts.bookmark.title',
      bodyKey: 'books.tutorial.tts.bookmark.body',
    },
    {
      anchorSelector: '[data-tutorial="books-reader-export"]',
      titleKey: 'books.tutorial.tts.export.title',
      bodyKey: 'books.tutorial.tts.export.body',
      action: { event: 'click', icon: 'download-simple' },
    },
  ],
};

export function registerBooksTtsTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(BOOKS_TTS_TUTORIAL, { autoStartIfUnseen: false });
  inject(DestroyRef).onDestroy(dispose);
}
