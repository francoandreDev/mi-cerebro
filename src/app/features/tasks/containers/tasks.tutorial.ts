import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: copy dedicado (no reciclado de home-content.ts) — cada step
//      describe un único gesto. La fecha se asigna en /tasks/:id (otra
//      ruta), así que ese step queda sin `action`.
export const TASKS_TUTORIAL: TutorialDefinition = {
  id: 'tasks',
  steps: [
    {
      anchorSelector: '[data-tutorial="tasks-compose"]',
      titleKey: 'tasks.tutorial.compose.title',
      bodyKey: 'tasks.tutorial.compose.body',
      action: { event: 'submit', icon: 'plus' },
    },
    {
      anchorSelector: '[data-tutorial="tasks-compose"]',
      titleKey: 'tasks.tutorial.date.title',
      bodyKey: 'tasks.tutorial.date.body',
    },
    {
      anchorSelector: '[data-tutorial="tasks-planters"]',
      titleKey: 'tasks.tutorial.transplant.title',
      bodyKey: 'tasks.tutorial.transplant.body',
      action: { event: 'keydown', key: 'ArrowRight', shiftKey: true, icon: 'arrow-right' },
    },
    {
      anchorSelector: '[data-tutorial="tasks-basket"]',
      titleKey: 'tasks.tutorial.harvest.title',
      bodyKey: 'tasks.tutorial.harvest.body',
    },
  ],
};

export function registerTasksTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(TASKS_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
