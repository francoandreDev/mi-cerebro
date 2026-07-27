import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: Alt+C/Alt+P son globales (document keydown, ver
//      `shared/editor/editor.component.ts`) y sólo hacen algo con una
//      selección de texto activa — los botones de la toolbar quedan
//      deshabilitados sin selección, así que el `action` escucha el
//      atajo (keydown), no el click, para no depender de que el usuario
//      haya seleccionado texto primero. Sin flujo equivalente todavía en
//      Notes/Writings (8.8 no implementado aún) — nada que cross-referenciar.
export const BOOKS_COLLAB_TUTORIAL: TutorialDefinition = {
  id: 'books-collab',
  pageId: 'books',
  labelKey: 'books.tutorial.flow.collab',
  steps: [
    {
      anchorSelector: '[data-tutorial="books-editor-comment"]',
      titleKey: 'books.tutorial.collab.comment.title',
      bodyKey: 'books.tutorial.collab.comment.body',
      action: { event: 'keydown', key: 'c', altKey: true, icon: 'chat-circle' },
    },
    {
      anchorSelector: '[data-tutorial="books-editor-propose"]',
      titleKey: 'books.tutorial.collab.propose.title',
      bodyKey: 'books.tutorial.collab.propose.body',
      action: { event: 'keydown', key: 'p', altKey: true, icon: 'git-branch' },
    },
  ],
};

export function registerBooksCollabTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(BOOKS_COLLAB_TUTORIAL, { autoStartIfUnseen: false });
  inject(DestroyRef).onDestroy(dispose);
}
