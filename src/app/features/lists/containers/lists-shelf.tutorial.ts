import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: mismo `id` que `lists.tutorial.ts` (el de /lists/:id) a propósito —
//      shelf y detalle nunca están montados a la vez, así que no hay
//      colisión en runtime y "Guía de la página" muestra el correcto según
//      cuál esté vivo. Copy dedicado, no reciclado de home-content.ts.
export const LISTS_SHELF_TUTORIAL: TutorialDefinition = {
  id: 'lists',
  steps: [
    {
      anchorSelector: '[data-tutorial="lists-shelf-new"]',
      titleKey: 'lists.tutorial.create.title',
      bodyKey: 'lists.tutorial.create.body',
      action: { event: 'submit', icon: 'plus' },
    },
    {
      anchorSelector: '[data-tutorial="lists-shelf-rail"]',
      titleKey: 'lists.tutorial.rail.title',
      bodyKey: 'lists.tutorial.rail.body',
      action: { event: 'click', icon: 'list-bullets' },
    },
  ],
};

export function registerListsShelfTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(LISTS_SHELF_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
