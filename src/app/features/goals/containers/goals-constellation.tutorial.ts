import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: §8.87 — el gap más grande de la auditoría 8.85: `/goals/:id`
//      (goal-constellation-editor.component.ts) nunca tuvo tutorial, y ahí
//      vive el gesto real que el bug 8.2 describía por error en la wall
//      (shift+click multi-selección + toolbar de lote). No lleva `route`:
//      a diferencia de home-flows.tutorial.ts (que navega a rutas fijas),
//      este flujo no tiene un id de meta concreto para deep-linkear — se
//      resuelve igual que books-tts/books-collab/books-editor-advanced
//      (registradas en BookReaderContainer, montado sólo en `/books/:id/
//      :chapterId`): `registerGoalsConstellationTutorial()` se llama desde
//      `GoalsContainer`, que sólo existe cuando el usuario ya está parado
//      en una meta concreta, así que el flujo sólo aparece en el picker
//      ("Guía de la página", `pageId: 'goals'` matchea `/goals` y `/goals/
//      :id` por igual vía `routePageId`) una vez que hay contexto real.
export const GOALS_CONSTELLATION_TUTORIAL: TutorialDefinition = {
  id: 'goals-constellation',
  pageId: 'goals',
  labelKey: 'goals.tutorial.flow.constellation',
  steps: [
    {
      anchorSelector: '[data-tutorial="goal-constellation-canvas"]',
      titleKey: 'goals.tutorial.constellation.create.title',
      bodyKey: 'goals.tutorial.constellation.create.body',
      action: { event: 'click', icon: 'plus' },
    },
    {
      anchorSelector: '[data-tutorial="goal-constellation-canvas"]',
      titleKey: 'goals.tutorial.constellation.drag.title',
      bodyKey: 'goals.tutorial.constellation.drag.body',
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="goal-star"]',
      titleKey: 'goals.tutorial.constellation.toggleDone.title',
      bodyKey: 'goals.tutorial.constellation.toggleDone.body',
      action: { event: 'click', icon: 'check' },
      skipIfMissing: true,
    },
    // why: click derecho es `contextmenu`, evento que TutorialStepAction no
    //      soporta (sólo click/submit/keydown/dragstart) — queda descriptivo,
    //      sin `action`, igual que el resto de gestos no detectables.
    {
      anchorSelector: '[data-tutorial="goal-constellation-canvas"]',
      titleKey: 'goals.tutorial.constellation.rename.title',
      bodyKey: 'goals.tutorial.constellation.rename.body',
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="goal-star-popover-delete"]',
      titleKey: 'goals.tutorial.constellation.delete.title',
      bodyKey: 'goals.tutorial.constellation.delete.body',
      action: { event: 'click', icon: 'trash' },
      skipIfMissing: true,
    },
    // why: el gesto real del bug 8.2 — shift+click multi-selección, que
    //      sólo existe acá, en `/goals/:id`, nunca en la wall.
    {
      anchorSelector: '[data-tutorial="goal-star"]',
      titleKey: 'goals.tutorial.constellation.multiSelect.title',
      bodyKey: 'goals.tutorial.constellation.multiSelect.body',
      action: { event: 'click', selector: '[data-tutorial="goal-star"]', shiftKey: true },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="goal-selection-toolbar"]',
      titleKey: 'goals.tutorial.constellation.batchToolbar.title',
      bodyKey: 'goals.tutorial.constellation.batchToolbar.body',
      action: { event: 'click', selector: '[data-tutorial="goal-selection-toggle-done"]' },
      skipIfMissing: true,
      moreDetail: { bodyKey: 'goals.tutorial.constellation.batchToolbar.moreDetail' },
    },
    {
      anchorSelector: '[data-tutorial="goal-deadline-chip"]',
      titleKey: 'goals.tutorial.constellation.deadline.title',
      bodyKey: 'goals.tutorial.constellation.deadline.body',
      action: { event: 'click', icon: 'calendar-blank' },
      moreDetail: { bodyKey: 'goals.tutorial.constellation.deadline.moreDetail' },
    },
    {
      anchorSelector: '[data-tutorial="goal-priority"]',
      titleKey: 'goals.tutorial.constellation.priority.title',
      bodyKey: 'goals.tutorial.constellation.priority.body',
      action: { event: 'click', selector: '[data-tutorial="goal-priority"] .prio-btn' },
    },
    {
      anchorSelector: '[data-tutorial="goal-reminder-enabled"]',
      titleKey: 'goals.tutorial.constellation.reminderEnabled.title',
      bodyKey: 'goals.tutorial.constellation.reminderEnabled.body',
      action: { event: 'click', selector: '[data-tutorial="goal-reminder-enabled"] input' },
    },
    // why: un <select> no tiene un gesto de click/keydown único y confiable
    //      para auto-detectar (abrir el dropdown nativo no dispara ninguno
    //      de los eventos que TutorialStepAction soporta) — queda
    //      descriptivo. skipIfMissing porque sólo se renderiza con el
    //      recordatorio activado.
    {
      anchorSelector: '[data-tutorial="goal-reminder-lead"]',
      titleKey: 'goals.tutorial.constellation.reminderLead.title',
      bodyKey: 'goals.tutorial.constellation.reminderLead.body',
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="goal-reminder-dormant"]',
      titleKey: 'goals.tutorial.constellation.reminderDormant.title',
      bodyKey: 'goals.tutorial.constellation.reminderDormant.body',
      action: { event: 'click', selector: '[data-tutorial="goal-reminder-dormant"] input' },
    },
  ],
};

export function registerGoalsConstellationTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(GOALS_CONSTELLATION_TUTORIAL, { autoStartIfUnseen: false });
  inject(DestroyRef).onDestroy(dispose);
}
