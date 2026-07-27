import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: copy dedicado (no reciclado de home-content.ts). El editor,
//      autosave y modo foco viven en /writings/:id (otra ruta, gateada a
//      que exista un escrito), así que esos steps quedan sin `action`.
export const WRITINGS_TUTORIAL: TutorialDefinition = {
  id: 'writings',
  pageId: 'writings',
  steps: [
    {
      anchorSelector: '[data-tutorial="writings-new"]',
      titleKey: 'writings.tutorial.create.title',
      bodyKey: 'writings.tutorial.create.body',
      action: { event: 'submit', icon: 'plus' },
    },
    {
      anchorSelector: '[data-tutorial="writings-editor"]',
      titleKey: 'writings.tutorial.editor.title',
      bodyKey: 'writings.tutorial.editor.body',
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="writings-editor"]',
      titleKey: 'writings.tutorial.autosave.title',
      bodyKey: 'writings.tutorial.autosave.body',
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="writings-editor"]',
      titleKey: 'writings.tutorial.focus.title',
      bodyKey: 'writings.tutorial.focus.body',
      action: { event: 'keydown', key: 'f', shiftKey: true, altKey: true, icon: 'eye' },
      skipIfMissing: true,
    },
  ],
};

export function registerWritingsTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(WRITINGS_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
