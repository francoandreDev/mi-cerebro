import { DestroyRef, inject } from '@angular/core';

import { buildEntityTutorial } from '@core/tutorials/entity-tutorial.builder';
import { TutorialService } from '@core/tutorials/tutorial.service';

export const TASKS_TUTORIAL = buildEntityTutorial('tasks', '[data-tutorial="tasks-compose"]', [
  // step 3: "la trasplantás de cantero con DnD o Shift+←/→" — apunta a los
  // tres canteros, no al form de alta.
  { step: 3, anchorSelector: '[data-tutorial="tasks-planters"]' },
  // step 4: "cuando la termines, la cosechás — la flor cae al canasto"
  { step: 4, anchorSelector: '[data-tutorial="tasks-basket"]' },
]);

export function registerTasksTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(TASKS_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
