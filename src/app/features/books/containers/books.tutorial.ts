import { DestroyRef, inject } from '@angular/core';

import { buildEntityTutorial } from '@core/tutorials/entity-tutorial.builder';
import { TutorialService } from '@core/tutorials/tutorial.service';

export const BOOKS_TUTORIAL = buildEntityTutorial('books', '[data-tutorial="books-new"]', [
  // step 2: "ajustás la densidad del estante" — el toggle real, no el botón
  // de crear libro.
  { step: 2, anchorSelector: '[data-tutorial="books-density"]' },
]);

export function registerBooksTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(BOOKS_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
