import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: copy dedicado (no reciclado de home-content.ts) — un gesto por
//      step. El estado del palomar (puerta que se abre, vencidos en la
//      repisa) es pasivo/temporal, así que ese step queda sin `action`.
//      §8.89: sumó búsqueda (mismo estilo "click en la zona" que filtros,
//      ya que tipear texto no es un evento practicable), recurrencia
//      (descriptivo — un <select> no tiene un evento único confiable, ver
//      goals-constellation.tutorial.ts) + pausa (action real sobre el
//      checkbox) dentro del detalle, y un step final de mención de
//      existencia para el toast de undo y el registro de "papelitos
//      tomados" — ninguno de los dos es un gesto a practicar.
export const REMINDERS_TUTORIAL: TutorialDefinition = {
  id: 'reminders',
  pageId: 'reminders',
  labelKey: 'reminders.tutorial.flow.essentials',
  steps: [
    {
      anchorSelector: '[data-tutorial="reminders-quick-add"]',
      titleKey: 'reminders.tutorial.compose.title',
      bodyKey: 'reminders.tutorial.compose.body',
      action: { event: 'submit', icon: 'plus' },
    },
    {
      anchorSelector: '[data-tutorial="reminders-palomar"]',
      titleKey: 'reminders.tutorial.open.title',
      bodyKey: 'reminders.tutorial.open.body',
      action: { event: 'click', icon: 'pencil-simple' },
    },
    {
      anchorSelector: '[data-tutorial="reminder-recurrence"]',
      titleKey: 'reminders.tutorial.recurrence.title',
      bodyKey: 'reminders.tutorial.recurrence.body',
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="reminder-pause"]',
      titleKey: 'reminders.tutorial.pause.title',
      bodyKey: 'reminders.tutorial.pause.body',
      action: { event: 'click', selector: '[data-tutorial="reminder-pause"] input', icon: 'check' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="reminders-palomar"]',
      titleKey: 'reminders.tutorial.states.title',
      bodyKey: 'reminders.tutorial.states.body',
    },
    {
      anchorSelector: '[data-tutorial="reminders-search"]',
      titleKey: 'reminders.tutorial.search.title',
      bodyKey: 'reminders.tutorial.search.body',
      action: { event: 'click', icon: 'magnifying-glass' },
    },
    {
      anchorSelector: '[data-tutorial="reminders-filters"]',
      titleKey: 'reminders.tutorial.filters.title',
      bodyKey: 'reminders.tutorial.filters.body',
      action: { event: 'click', icon: 'funnel' },
    },
    {
      anchorSelector: '[data-tutorial="reminders-registry"]',
      titleKey: 'reminders.tutorial.existence.title',
      bodyKey: 'reminders.tutorial.existence.body',
    },
  ],
};

export function registerRemindersTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(REMINDERS_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
