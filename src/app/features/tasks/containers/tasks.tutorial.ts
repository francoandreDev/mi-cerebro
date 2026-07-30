import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: copy dedicado (no reciclado de home-content.ts) — cada step
//      describe un único gesto. La fecha se asigna en /tasks/:id (otra
//      ruta), así que ese step queda sin `action`.
export const TASKS_TUTORIAL: TutorialDefinition = {
  id: 'tasks',
  pageId: 'tasks',
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
      moreDetail: { bodyKey: 'tasks.tutorial.date.moreDetail' },
    },
    {
      anchorSelector: '[data-tutorial="tasks-planters"]',
      titleKey: 'tasks.tutorial.transplant.title',
      bodyKey: 'tasks.tutorial.transplant.body',
      action: { event: 'keydown', key: 'ArrowRight', shiftKey: true, icon: 'arrow-right' },
    },
    // why: el atajo de teclado ya tenía step propio — esto lo complementa
    //      con la alternativa de mouse, practicable con `action.dragstart`
    //      (§8.9 roadmap). tier avanzado porque el atajo alcanza para el
    //      circuito básico.
    {
      anchorSelector: '[data-tutorial="tasks-planters"]',
      titleKey: 'tasks.tutorial.transplantDrag.title',
      bodyKey: 'tasks.tutorial.transplantDrag.body',
      action: { event: 'dragstart', icon: 'arrows-clockwise' },
      tier: 'avanzado',
    },
    {
      anchorSelector: '[data-tutorial="tasks-basket"]',
      titleKey: 'tasks.tutorial.harvest.title',
      bodyKey: 'tasks.tutorial.harvest.body',
    },
    // why: la mecánica de riego/marchitamiento vive físicamente en el
    //      jardín (`onWater()`, botón 🚿), no en /tasks/patio como asumía
    //      el roadmap original — movida acá (ver desvío documentado en
    //      roadmap-26-tutoriales.md §8.9).
    {
      anchorSelector: '[data-tutorial="tasks-water-toggle"]',
      titleKey: 'tasks.tutorial.water.title',
      bodyKey: 'tasks.tutorial.water.body',
      action: { event: 'click' },
      tier: 'avanzado',
    },
  ],
};

export function registerTasksTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(TASKS_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
