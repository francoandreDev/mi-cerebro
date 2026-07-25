import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: copy dedicado (no reciclado de home-content.ts). Crear una entrada
//      desde el modal del día navega a otra página (/tasks, /goals,
//      /reminders) — no hay un anchor de acción único que practicar sin
//      sacar al usuario de /calendar a mitad del tutorial, así que ese
//      step queda sin `action`.
export const CALENDAR_TUTORIAL: TutorialDefinition = {
  id: 'calendar',
  steps: [
    {
      anchorSelector: '[data-tutorial="calendar-views"]',
      titleKey: 'calendar.tutorial.views.title',
      bodyKey: 'calendar.tutorial.views.body',
      action: { event: 'click', icon: 'calendar-dots' },
    },
    {
      anchorSelector: '[data-tutorial="calendar-table"]',
      titleKey: 'calendar.tutorial.day.title',
      bodyKey: 'calendar.tutorial.day.body',
      action: { event: 'click', icon: 'calendar-check' },
    },
    {
      anchorSelector: '[data-tutorial="calendar-table"]',
      titleKey: 'calendar.tutorial.create.title',
      bodyKey: 'calendar.tutorial.create.body',
    },
    {
      anchorSelector: '[data-tutorial="calendar-wallboard"]',
      titleKey: 'calendar.tutorial.filter.title',
      bodyKey: 'calendar.tutorial.filter.body',
      action: { event: 'click', icon: 'funnel' },
    },
  ],
};

export function registerCalendarTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(CALENDAR_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
