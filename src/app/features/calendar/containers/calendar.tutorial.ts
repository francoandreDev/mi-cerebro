import { DestroyRef, inject } from '@angular/core';

import { buildEntityTutorial } from '@core/tutorials/entity-tutorial.builder';
import { TutorialService } from '@core/tutorials/tutorial.service';

export const CALENDAR_TUTORIAL = buildEntityTutorial(
  'calendar',
  '[data-tutorial="calendar-table"]',
  [
    // step 1: "vista mensual por default. Cambiás a vista anual desde la
    // toolbar" — el selector de vista, no la grilla.
    { step: 1, anchorSelector: '[data-tutorial="calendar-views"]' },
  ],
);

export function registerCalendarTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(CALENDAR_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
