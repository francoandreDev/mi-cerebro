import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: copy dedicado (no reciclado de home-content.ts). `trash-bar` es el
//      único anchor siempre presente (la grilla de cards no renderiza si
//      la papelera está vacía — caso típico de un usuario nuevo), así que
//      los 3 steps reusan ese anchor.
export const TRASH_TUTORIAL: TutorialDefinition = {
  id: 'trash',
  pageId: 'trash',
  steps: [
    {
      anchorSelector: '[data-tutorial="trash-bar"]',
      titleKey: 'trash.tutorial.appears.title',
      bodyKey: 'trash.tutorial.appears.body',
    },
    {
      anchorSelector: '[data-tutorial="trash-bar"]',
      titleKey: 'trash.tutorial.search.title',
      bodyKey: 'trash.tutorial.search.body',
      action: { event: 'click', icon: 'magnifying-glass' },
    },
    // why: la barra de filtros no renderiza con la papelera vacía — mismo
    //      motivo por el que el resto de steps nuevos también llevan
    //      `skipIfMissing`.
    {
      anchorSelector: '[data-tutorial="trash-filter-bar"]',
      titleKey: 'trash.tutorial.filter.title',
      bodyKey: 'trash.tutorial.filter.body',
      action: { event: 'click', selector: '[data-tutorial="trash-filter-bar"] .chip' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="trash-card-view"]',
      titleKey: 'trash.tutorial.view.title',
      bodyKey: 'trash.tutorial.view.body',
      action: { event: 'click', icon: 'eye' },
      skipIfMissing: true,
      moreDetail: { bodyKey: 'trash.tutorial.view.moreDetail' },
    },
    {
      anchorSelector: '[data-tutorial="trash-bar"]',
      titleKey: 'trash.tutorial.restore.title',
      bodyKey: 'trash.tutorial.restore.body',
      // why: validates the tier filter end-to-end (see roadmap-26-tutoriales.md
      //      item 8.1) — retention detail is a power-user fact, not required
      //      for a first real use of the page.
      tier: 'avanzado',
    },
    {
      anchorSelector: '[data-tutorial="trash-card-purge"]',
      titleKey: 'trash.tutorial.purge.title',
      bodyKey: 'trash.tutorial.purge.body',
      action: { event: 'click', icon: 'trash' },
      tier: 'avanzado',
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="trash-empty-all"]',
      titleKey: 'trash.tutorial.emptyAll.title',
      bodyKey: 'trash.tutorial.emptyAll.body',
      action: { event: 'click', icon: 'broom' },
      tier: 'avanzado',
      skipIfMissing: true,
    },
  ],
};

export function registerTrashTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(TRASH_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
