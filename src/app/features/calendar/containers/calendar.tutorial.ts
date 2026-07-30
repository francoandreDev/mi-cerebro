import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: copy dedicado (no reciclado de home-content.ts). Crear una entrada
//      desde el modal del día navega a otra página (/tasks, /goals,
//      /reminders) — no hay un anchor de acción único que practicar sin
//      sacar al usuario de /calendar a mitad del tutorial, así que ese
//      step queda sin `action`.
// why: §8.88 — sumó los gestos avanzados que el audit 8.85 había dejado
//      fuera del toolbar (búsqueda, "ir a fecha"), el drag-and-drop de
//      tareas del wallboard, y el toggle/creación de las kind-cards.
//      `calendar-toolbar` es un anchor nuevo (el toolbar no vive dentro de
//      `calendar-views`/`calendar-table`) — mismo patrón que
//      `books-catalog` en books.tutorial.ts: un anchor propio para
//      contenido avanzado en vez de forzarlo sobre uno de los 3 anchors
//      existentes. El drag-and-drop sí ancla en `calendar-table` (donde cae
//      la tarea) con `action.selector` apuntando al `<li draggable>` real
//      del wallboard, y el toggle/create de las kind-cards ancla en
//      `calendar-wallboard` — esos dos si coinciden con los anchors ya
//      existentes. Botón "Hoy" y selects de mes/año quedan como
//      `moreDetail` del step "views" (mención de existencia, sin action).
export const CALENDAR_TUTORIAL: TutorialDefinition = {
  id: 'calendar',
  pageId: 'calendar',
  steps: [
    {
      anchorSelector: '[data-tutorial="calendar-views"]',
      titleKey: 'calendar.tutorial.views.title',
      bodyKey: 'calendar.tutorial.views.body',
      action: { event: 'click', icon: 'calendar-dots' },
      moreDetail: { bodyKey: 'calendar.tutorial.views.moreDetail' },
    },
    {
      anchorSelector: '[data-tutorial="calendar-toolbar"]',
      titleKey: 'calendar.tutorial.search.title',
      bodyKey: 'calendar.tutorial.search.body',
      tier: 'avanzado',
    },
    {
      anchorSelector: '[data-tutorial="calendar-toolbar"]',
      titleKey: 'calendar.tutorial.gotoDate.title',
      bodyKey: 'calendar.tutorial.gotoDate.body',
      action: { event: 'click', selector: '[data-tutorial="calendar-toolbar"] .date-input' },
      tier: 'avanzado',
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
      anchorSelector: '[data-tutorial="calendar-table"]',
      titleKey: 'calendar.tutorial.dragReschedule.title',
      bodyKey: 'calendar.tutorial.dragReschedule.body',
      action: {
        event: 'dragstart',
        selector: '[data-tutorial="calendar-wallboard"] li[draggable="true"]',
        icon: 'arrows-clockwise',
      },
      skipIfMissing: true,
      tier: 'avanzado',
    },
    {
      anchorSelector: '[data-tutorial="calendar-wallboard"]',
      titleKey: 'calendar.tutorial.filter.title',
      bodyKey: 'calendar.tutorial.filter.body',
      action: { event: 'click', icon: 'funnel' },
    },
    {
      anchorSelector: '[data-tutorial="calendar-wallboard"]',
      titleKey: 'calendar.tutorial.kindToggle.title',
      bodyKey: 'calendar.tutorial.kindToggle.body',
      action: { event: 'click', selector: '[data-tutorial="calendar-wallboard"] .toggle' },
      tier: 'avanzado',
    },
    {
      anchorSelector: '[data-tutorial="calendar-wallboard"]',
      titleKey: 'calendar.tutorial.kindCreate.title',
      bodyKey: 'calendar.tutorial.kindCreate.body',
      action: {
        event: 'click',
        selector: '[data-tutorial="calendar-wallboard"] .add',
        icon: 'plus',
      },
      tier: 'avanzado',
    },
  ],
};

export function registerCalendarTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(CALENDAR_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
