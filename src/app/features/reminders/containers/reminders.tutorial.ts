import { DestroyRef, inject } from '@angular/core';

import { buildEntityTutorial } from '@core/tutorials/entity-tutorial.builder';
import { TutorialService } from '@core/tutorials/tutorial.service';

export const REMINDERS_TUTORIAL = buildEntityTutorial(
  'reminders',
  '[data-tutorial="reminders-quick-add"]',
  [
    // step 3: "...filtros por fecha/nombre arriba para no perderse" — el
    // rango de fechas real, no el compose bar.
    { step: 3, anchorSelector: '[data-tutorial="reminders-filters"]' },
  ],
);

export function registerRemindersTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(REMINDERS_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
