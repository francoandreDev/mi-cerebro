import { DestroyRef, inject } from '@angular/core';

import { buildEntityTutorial } from '@core/tutorials/entity-tutorial.builder';
import { TutorialService } from '@core/tutorials/tutorial.service';

export const VARIANTS_TUTORIAL = buildEntityTutorial(
  'variants',
  '[data-tutorial="variants-create"]',
  [
    // steps 2-4: "la activás", "volvés a la original", "mergeás o
    // descartás" — pasan en el delta (canvas), no en el botón de crear.
    { step: 2, anchorSelector: '[data-tutorial="variants-canvas"]' },
    { step: 3, anchorSelector: '[data-tutorial="variants-canvas"]' },
    { step: 4, anchorSelector: '[data-tutorial="variants-canvas"]' },
  ],
);

export function registerVariantsTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(VARIANTS_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
