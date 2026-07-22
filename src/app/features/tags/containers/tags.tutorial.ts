import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: Etiquetas no tiene card propia en home-content.ts — copy nuevo,
//      verificado contra tags.container.html: las etiquetas se crean desde
//      otras entidades (no hay alta acá), y las filas (recolor/rename/
//      merge/eliminar) solo existen cuando ya hay al menos un tag — se
//      avisa en el texto en vez de anclar el spotlight a una fila que
//      puede no existir todavía.
export const TAGS_TUTORIAL: TutorialDefinition = {
  id: 'tags',
  steps: [
    {
      anchorSelector: '[data-tutorial="tags-header"]',
      titleKey: 'tags.page.title',
      bodyKey: 'tags.tutorial.origin.body',
    },
    {
      anchorSelector: '[data-tutorial="tags-header"]',
      titleKey: 'tags.page.title',
      bodyKey: 'tags.tutorial.rowActions.body',
    },
  ],
};

export function registerTagsTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(TAGS_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
