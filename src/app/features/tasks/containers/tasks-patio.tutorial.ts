import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: registrado desde el jardín (`/tasks`, no `/tasks/patio`) para que el
//      picker de la página principal pueda ofrecerlo y navegar con
//      `route` — a diferencia de `/tasks/:id` (sin id fijo), `/tasks/patio`
//      es una ruta literal, así que sí califica para `TutorialStep.route`.
//      Verificado contra `tasks-patio.container.ts`/`.html`: la página es
//      un archivo de solo lectura (mes por mes de tareas ya cosechadas),
//      sin riego ni gesto de cosecha propio — esos viven en el jardín
//      (ver desvío en roadmap-26-tutoriales.md §8.9).
export const TASKS_PATIO_TUTORIAL: TutorialDefinition = {
  id: 'tasks-patio',
  pageId: 'tasks',
  labelKey: 'tasks.tutorial.flow.patio',
  steps: [
    {
      anchorSelector: '[data-tutorial="tasks-patio-header"]',
      titleKey: 'tasks.tutorial.patio.intro.title',
      bodyKey: 'tasks.tutorial.patio.intro.body',
      route: '/tasks/patio',
    },
    {
      anchorSelector: '[data-tutorial="tasks-patio-grove"]',
      titleKey: 'tasks.tutorial.patio.shape.title',
      bodyKey: 'tasks.tutorial.patio.shape.body',
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="tasks-patio-item"]',
      titleKey: 'tasks.tutorial.patio.open.title',
      bodyKey: 'tasks.tutorial.patio.open.body',
      action: { event: 'click', icon: 'arrow-square-out' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="tasks-patio-back"]',
      titleKey: 'tasks.tutorial.patio.back.title',
      bodyKey: 'tasks.tutorial.patio.back.body',
      action: { event: 'click', icon: 'arrow-left' },
    },
  ],
};

export function registerTasksPatioTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(TASKS_PATIO_TUTORIAL, { autoStartIfUnseen: false });
  inject(DestroyRef).onDestroy(dispose);
}
