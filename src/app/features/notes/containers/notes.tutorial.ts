import { DestroyRef, inject } from '@angular/core';

import { buildEntityTutorial } from '@core/tutorials/entity-tutorial.builder';
import { TutorialService } from '@core/tutorials/tutorial.service';

export const NOTES_TUTORIAL = buildEntityTutorial('notes', '[data-tutorial="notes-compose"]', [
  // step 4: "la encontrás con Ctrl+K o los chips de filtro arriba" — el
  // buscador/filtro real vive en la filter bar, no en la compose bar.
  { step: 4, anchorSelector: '[data-tutorial="notes-search"]' },
]);

export function registerNotesTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(NOTES_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
