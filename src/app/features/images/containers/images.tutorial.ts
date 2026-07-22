import { DestroyRef, inject } from '@angular/core';

import { buildEntityTutorial } from '@core/tutorials/entity-tutorial.builder';
import { TutorialService } from '@core/tutorials/tutorial.service';

export const IMAGES_TUTORIAL = buildEntityTutorial('images', '[data-tutorial="images-new"]');

export function registerImagesTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(IMAGES_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
