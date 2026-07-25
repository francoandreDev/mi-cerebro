import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: copy dedicado (no reciclado de home-content.ts) — un gesto por
//      step. El estado del palomar (puerta que se abre, vencidos en la
//      repisa) es pasivo/temporal, así que ese step queda sin `action`.
export const REMINDERS_TUTORIAL: TutorialDefinition = {
  id: 'reminders',
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
      anchorSelector: '[data-tutorial="reminders-palomar"]',
      titleKey: 'reminders.tutorial.states.title',
      bodyKey: 'reminders.tutorial.states.body',
    },
    {
      anchorSelector: '[data-tutorial="reminders-filters"]',
      titleKey: 'reminders.tutorial.filters.title',
      bodyKey: 'reminders.tutorial.filters.body',
      action: { event: 'click', icon: 'funnel' },
    },
  ],
};

export function registerRemindersTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(REMINDERS_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
