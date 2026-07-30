import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: §8.11 (re-scoped por 8.85) — `/variants/merge` es una ruta propia,
//      totalmente fuera del flujo esencial de `variants`, con 6+ gestos
//      propios (selector, swap, bulk, elegir por archivo, aplicar,
//      reintentar/saltar). Registrado desde MergeContainer, el único lugar
//      donde esta página existe — comparte `pageId: 'variants'`
//      (routePageId sólo mira el primer segmento de la URL, así que
//      /variants/merge también matchea 'variants') para que el picker
//      "Guía de la página" lo agrupe con el resto de flujos de Variants.
//      Sin `route`: a diferencia de un flujo cross-página real
//      (home-flows.tutorial.ts), este sólo puede arrancar mientras
//      MergeContainer está montado — es decir, ya parado en /variants/merge
//      — así que no hace falta navegar a ningún lado (mismo patrón que
//      `goals-constellation`/`books-tts`: definición registrada solo donde
//      su página vive).
export const VARIANTS_MERGE_TUTORIAL: TutorialDefinition = {
  id: 'variants-merge',
  pageId: 'variants',
  labelKey: 'merge.tutorial.flow.merge',
  steps: [
    {
      anchorSelector: '[data-tutorial="merge-selector-bar"]',
      titleKey: 'merge.tutorial.selector.title',
      bodyKey: 'merge.tutorial.selector.body',
    },
    {
      anchorSelector: '[data-tutorial="merge-swap"]',
      titleKey: 'merge.tutorial.swap.title',
      bodyKey: 'merge.tutorial.swap.body',
      action: { event: 'click' },
    },
    {
      anchorSelector: '[data-tutorial="merge-bulk-from"]',
      titleKey: 'merge.tutorial.bulk.title',
      bodyKey: 'merge.tutorial.bulk.body',
      action: { event: 'click' },
      moreDetail: { bodyKey: 'merge.tutorial.bulk.moreDetail' },
    },
    {
      anchorSelector: '[data-tutorial="merge-file-choice"]',
      titleKey: 'merge.tutorial.fileChoice.title',
      bodyKey: 'merge.tutorial.fileChoice.body',
      action: { event: 'click', selector: '[data-tutorial="merge-file-choice"] button' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="merge-apply"]',
      titleKey: 'merge.tutorial.apply.title',
      bodyKey: 'merge.tutorial.apply.body',
      action: { event: 'click', icon: 'check' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="merge-retry"]',
      titleKey: 'merge.tutorial.retry.title',
      bodyKey: 'merge.tutorial.retry.body',
      action: { event: 'click' },
      skipIfMissing: true,
      tier: 'avanzado',
      moreDetail: { bodyKey: 'merge.tutorial.retry.moreDetail' },
    },
  ],
};

export function registerVariantsMergeTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(VARIANTS_MERGE_TUTORIAL, { autoStartIfUnseen: false });
  inject(DestroyRef).onDestroy(dispose);
}
