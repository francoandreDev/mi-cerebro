import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: §8.88 — la vista semana ("leather book") es una zona sustancial que
//      el audit original (8.85) no había recorrido: navegación prev/next
//      semana, click día, 4 botones de creación rápida por tipo, cerrar.
//      Flujo manual (no `autoStartIfUnseen`) porque `calendar` ya cubre el
//      onboarding automático de la página — este es descubrible desde el
//      picker "Guía de la página" (`pageId: 'calendar'` agrupa ambos).
//      El primer step practica entrar a la vista semana clickeando el chip
//      "Semana" (`calendar-view-week`, selector propio y no el genérico
//      `calendar-views` del flujo principal, para no pisar su `action`); los
//      4 siguientes anclan en sub-zonas del libro mismo
//      (`calendar-book-nav`/`-days`/`-create`/`-close`), todas nuevas. La
//      creación rápida por tipo navega a /tasks, /goals, /reminders o
//      /notes (igual que el modal del día en el flujo principal) — sin
//      `action` por el mismo motivo: no sacar al usuario del tutorial a
//      mitad de camino. "Abrir libro" desde el modal del día es el punto de
//      entrada alternativo a este flujo, no un gesto propio — va como
//      `moreDetail` del primer step en vez de un step aparte.
export const CALENDAR_WEEK_TUTORIAL: TutorialDefinition = {
  id: 'calendar-week',
  pageId: 'calendar',
  labelKey: 'calendar.tutorial.flow.week',
  steps: [
    {
      anchorSelector: '[data-tutorial="calendar-view-week"]',
      titleKey: 'calendar.tutorial.week.enter.title',
      bodyKey: 'calendar.tutorial.week.enter.body',
      action: { event: 'click', icon: 'books' },
      moreDetail: { bodyKey: 'calendar.tutorial.week.enter.moreDetail' },
    },
    {
      anchorSelector: '[data-tutorial="calendar-book-nav"]',
      titleKey: 'calendar.tutorial.week.nav.title',
      bodyKey: 'calendar.tutorial.week.nav.body',
      action: { event: 'click', icon: 'caret-left' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="calendar-book-days"]',
      titleKey: 'calendar.tutorial.week.pickDay.title',
      bodyKey: 'calendar.tutorial.week.pickDay.body',
      action: { event: 'click', selector: '[data-tutorial="calendar-book-days"] .day-row' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="calendar-book-create"]',
      titleKey: 'calendar.tutorial.week.create.title',
      bodyKey: 'calendar.tutorial.week.create.body',
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="calendar-book-close"]',
      titleKey: 'calendar.tutorial.week.close.title',
      bodyKey: 'calendar.tutorial.week.close.body',
      action: { event: 'click', icon: 'x' },
      skipIfMissing: true,
    },
  ],
};

export function registerCalendarWeekTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(CALENDAR_WEEK_TUTORIAL, { autoStartIfUnseen: false });
  inject(DestroyRef).onDestroy(dispose);
}
