import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: copy dedicado por paso (no reciclado de home-content.ts) — cada
//      step describe un único gesto concreto, con acción real donde el
//      gesto ocurre en esta misma página. Tags/formato viven en
//      /notes/:id (otra ruta, gateada a que exista una nota), así que esos
//      dos steps quedan sin `action` — se practican después de abrir una
//      nota, no acá.
export const NOTES_TUTORIAL: TutorialDefinition = {
  id: 'notes',
  pageId: 'notes',
  labelKey: 'notes.tutorial.flow.essentials',
  steps: [
    {
      anchorSelector: '[data-tutorial="notes-compose"]',
      titleKey: 'notes.tutorial.compose.title',
      bodyKey: 'notes.tutorial.compose.body',
      action: { event: 'submit', icon: 'plus' },
    },
    {
      anchorSelector: '[data-tutorial="notes-wall"]',
      titleKey: 'notes.tutorial.format.title',
      bodyKey: 'notes.tutorial.format.body',
      action: {
        event: 'click',
        selector: '[data-tutorial="notes-wall"] article.slip',
        icon: 'note',
      },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="notes-tag-picker"]',
      titleKey: 'notes.tutorial.tags.title',
      bodyKey: 'notes.tutorial.tags.body',
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="notes-search"]',
      titleKey: 'notes.tutorial.search.title',
      bodyKey: 'notes.tutorial.search.body',
      action: { event: 'keydown', key: 'k', ctrlOrMeta: true, icon: 'magnifying-glass' },
    },
  ],
};

export function registerNotesTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(NOTES_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
