import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: copy dedicado (no reciclado de home-content.ts). `trash-bar` es el
//      único anchor siempre presente (la grilla de cards no renderiza si
//      la papelera está vacía — caso típico de un usuario nuevo), así que
//      los 3 steps reusan ese anchor.
export const TRASH_TUTORIAL: TutorialDefinition = {
  id: 'trash',
  steps: [
    {
      anchorSelector: '[data-tutorial="trash-bar"]',
      titleKey: 'trash.tutorial.appears.title',
      bodyKey: 'trash.tutorial.appears.body',
    },
    {
      anchorSelector: '[data-tutorial="trash-bar"]',
      titleKey: 'trash.tutorial.search.title',
      bodyKey: 'trash.tutorial.search.body',
      action: { event: 'click', icon: 'magnifying-glass' },
    },
    {
      anchorSelector: '[data-tutorial="trash-bar"]',
      titleKey: 'trash.tutorial.restore.title',
      bodyKey: 'trash.tutorial.restore.body',
      // why: validates the tier filter end-to-end (see roadmap-26-tutoriales.md
      //      item 8.1) — retention detail is a power-user fact, not required
      //      for a first real use of the page.
      tier: 'avanzado',
    },
  ],
};

export function registerTrashTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(TRASH_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
