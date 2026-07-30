import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: copy dedicado (no reciclado de home-content.ts). Activar/volver y
//      merge/borrar pasan en el drawer de detalle (dentro del canvas, sin
//      anchor propio) — quedan sin `action`, describen el gesto real.
//      §8.11 (re-scoped por 8.85): filtro de búsqueda y refresh de
//      actividad se suman como `moreDetail` sobre el step `select` (no
//      merecen step propio, son gestos sueltos sobre un anchor ya
//      cubierto); la leyenda es una mención de existencia — step sin
//      `action` porque el popover es demasiado situacional para practicarse.
export const VARIANTS_TUTORIAL: TutorialDefinition = {
  id: 'variants',
  pageId: 'variants',
  labelKey: 'variants.tutorial.flow.essentials',
  steps: [
    {
      anchorSelector: '[data-tutorial="variants-create"]',
      titleKey: 'variants.tutorial.create.title',
      bodyKey: 'variants.tutorial.create.body',
      action: { event: 'click', icon: 'plus' },
    },
    {
      anchorSelector: '[data-tutorial="variants-create"]',
      titleKey: 'variants.tutorial.confirm.title',
      bodyKey: 'variants.tutorial.confirm.body',
      action: { event: 'keydown', key: 'Enter', ctrlOrMeta: true, icon: 'check' },
    },
    {
      anchorSelector: '[data-tutorial="variants-canvas"]',
      titleKey: 'variants.tutorial.select.title',
      bodyKey: 'variants.tutorial.select.body',
      action: { event: 'click', icon: 'git-branch' },
      moreDetail: { bodyKey: 'variants.tutorial.select.moreDetail' },
    },
    {
      anchorSelector: '[data-tutorial="variants-canvas"]',
      titleKey: 'variants.tutorial.switch.title',
      bodyKey: 'variants.tutorial.switch.body',
    },
    {
      anchorSelector: '[data-tutorial="variants-canvas"]',
      titleKey: 'variants.tutorial.merge.title',
      bodyKey: 'variants.tutorial.merge.body',
    },
    {
      anchorSelector: '[data-tutorial="variants-legend"]',
      titleKey: 'variants.tutorial.legend.title',
      bodyKey: 'variants.tutorial.legend.body',
      tier: 'avanzado',
    },
  ],
};

export function registerVariantsTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(VARIANTS_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
