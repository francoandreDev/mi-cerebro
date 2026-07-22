import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: "modo tiza" es un botón sin preview de lo que hay adentro — al
//      activarlo aparece de golpe una toolbar completa (paleta, grosores,
//      capas, exportar). El botón vive siempre en el DOM (activo o no), así
//      que ancla ambos pasos aunque el usuario todavía no haya tocado nada.
export const LISTS_TUTORIAL: TutorialDefinition = {
  id: 'lists',
  steps: [
    {
      anchorSelector: '[data-tutorial="lists-chalk-bar"]',
      titleKey: 'lists.tutorial.toggle.title',
      bodyKey: 'lists.tutorial.toggle.body',
      placement: 'bottom',
    },
    {
      anchorSelector: '[data-tutorial="lists-chalk-bar"]',
      titleKey: 'lists.tutorial.tools.title',
      bodyKey: 'lists.tutorial.tools.body',
      placement: 'bottom',
    },
  ],
};

export function registerListsTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(LISTS_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
