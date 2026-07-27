import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: copy dedicado (no reciclado de home-content.ts). Activar/volver y
//      merge/borrar pasan en el drawer de detalle (dentro del canvas, sin
//      anchor propio) — quedan sin `action`, describen el gesto real.
export const VARIANTS_TUTORIAL: TutorialDefinition = {
  id: 'variants',
  pageId: 'variants',
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
  ],
};

export function registerVariantsTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(VARIANTS_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
