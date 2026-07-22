import { DestroyRef, inject } from '@angular/core';

import { buildEntityTutorial } from '@core/tutorials/entity-tutorial.builder';
import { TutorialService } from '@core/tutorials/tutorial.service';

export const FILES_TUTORIAL = buildEntityTutorial('files', '[data-tutorial="files-new"]');

export function registerFilesTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(FILES_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
