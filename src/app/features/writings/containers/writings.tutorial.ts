import { DestroyRef, inject } from '@angular/core';

import { buildEntityTutorial } from '@core/tutorials/entity-tutorial.builder';
import { TutorialService } from '@core/tutorials/tutorial.service';

export const WRITINGS_TUTORIAL = buildEntityTutorial('writings', '[data-tutorial="writings-new"]');

export function registerWritingsTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(WRITINGS_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
