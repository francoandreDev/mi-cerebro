import { DestroyRef, inject } from '@angular/core';

import { buildEntityTutorial } from '@core/tutorials/entity-tutorial.builder';
import { TutorialService } from '@core/tutorials/tutorial.service';

export const TRASH_TUTORIAL = buildEntityTutorial('trash', '[data-tutorial="trash-bar"]');

export function registerTrashTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(TRASH_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
