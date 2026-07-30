import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: el modal "Biblioteca" (buscar, filtrar, vista, agrupar/ordenar,
//      cerrar) es un flujo cohesivo e independiente de crear/editar un
//      escrito (`writings.tutorial.ts`) — separado por §8.92. Todos los
//      steps salvo el primero viven detrás de `libraryOpen()`, así que
//      llevan `skipIfMissing: true` (mismo patrón que los steps de
//      `books-reader-*` que dependen de haber practicado el step previo).
//      "Agrupar/ordenar" es un único step (roadmap los agrupa como un solo
//      gesto): la acción real es el toggle de agrupar, el select de orden
//      queda en `moreDetail` — mismo patrón que `books.tutorial.density`.
export const WRITINGS_LIBRARY_TUTORIAL: TutorialDefinition = {
  id: 'writings-library',
  pageId: 'writings',
  labelKey: 'writings.tutorial.flow.library',
  steps: [
    {
      anchorSelector: '[data-tutorial="writings-library-open"]',
      titleKey: 'writings.tutorial.library.open.title',
      bodyKey: 'writings.tutorial.library.open.body',
      action: { event: 'click', icon: 'books' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="writings-library-search"]',
      titleKey: 'writings.tutorial.library.search.title',
      bodyKey: 'writings.tutorial.library.search.body',
      action: { event: 'click', icon: 'magnifying-glass' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="writings-library-view"]',
      titleKey: 'writings.tutorial.library.view.title',
      bodyKey: 'writings.tutorial.library.view.body',
      action: { event: 'click', icon: 'squares-four' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="writings-library-group"]',
      titleKey: 'writings.tutorial.library.group.title',
      bodyKey: 'writings.tutorial.library.group.body',
      action: { event: 'click', icon: 'folder' },
      moreDetail: { bodyKey: 'writings.tutorial.library.group.moreDetail' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="writings-library-dialog"]',
      titleKey: 'writings.tutorial.library.close.title',
      bodyKey: 'writings.tutorial.library.close.body',
      action: { event: 'keydown', key: 'escape', icon: 'x' },
      skipIfMissing: true,
    },
  ],
};

export function registerWritingsLibraryTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(WRITINGS_LIBRARY_TUTORIAL, { autoStartIfUnseen: false });
  inject(DestroyRef).onDestroy(dispose);
}
