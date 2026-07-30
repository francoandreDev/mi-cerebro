import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: mismo `id` que `lists.tutorial.ts` (el de /lists/:id) a propósito —
//      shelf y detalle nunca están montados a la vez, así que no hay
//      colisión en runtime y "Guía de la página" muestra el correcto según
//      cuál esté vivo. Copy dedicado, no reciclado de home-content.ts.
export const LISTS_SHELF_TUTORIAL: TutorialDefinition = {
  id: 'lists',
  pageId: 'lists',
  labelKey: 'lists.tutorial.flow.essentials',
  steps: [
    {
      anchorSelector: '[data-tutorial="lists-shelf-new"]',
      titleKey: 'lists.tutorial.create.title',
      bodyKey: 'lists.tutorial.create.body',
      action: { event: 'submit', icon: 'plus' },
    },
    {
      anchorSelector: '[data-tutorial="lists-shelf-rail"]',
      titleKey: 'lists.tutorial.rail.title',
      bodyKey: 'lists.tutorial.rail.body',
      action: { event: 'click', icon: 'list-bullets' },
    },
    // why: §8.14 (roadmap-26-tutoriales.md) — la búsqueda es "mención de
    //      existencia" (mismo motivo que goals.tutorial.filters.body §8.87
    //      2b): demasiadas combinaciones de texto válidas para un único
    //      gesto a practicar, así que este step no lleva `action`.
    {
      anchorSelector: '[data-tutorial="lists-shelf-search"]',
      titleKey: 'lists.tutorial.search.title',
      bodyKey: 'lists.tutorial.search.body',
      placement: 'bottom',
    },
    // why: cambiar de eje sí es un click concreto (alterna A-Z / Tags) —
    //      el selector matchea cualquiera de los dos botones del grupo, el
    //      click en cualquiera cuenta como practicado (ver
    //      tutorial.types.ts: el overlay escucha el evento DOM, no el
    //      output de la app).
    {
      anchorSelector: '[data-tutorial="lists-shelf-axis"]',
      titleKey: 'lists.tutorial.axis.title',
      bodyKey: 'lists.tutorial.axis.body',
      action: {
        event: 'click',
        selector: '[data-tutorial="lists-shelf-axis"] .axis-btn',
        icon: 'sort-ascending',
      },
    },
    // why: borrar es destructivo (confirm dialog, mueve a papelera) — igual
    //      que goal-peek-delete (§8.87), skipIfMissing porque necesita al
    //      menos una lista creada, y moreDetail explica que pasa por
    //      confirmación en vez de borrar directo.
    {
      anchorSelector: '[data-tutorial="lists-shelf-entry"]',
      titleKey: 'lists.tutorial.deleteEntry.title',
      bodyKey: 'lists.tutorial.deleteEntry.body',
      action: {
        event: 'click',
        selector: '[data-tutorial="lists-shelf-entry"] .delete',
        icon: 'trash',
      },
      skipIfMissing: true,
      moreDetail: { bodyKey: 'lists.tutorial.deleteEntry.moreDetail' },
    },
  ],
};

export function registerListsShelfTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(LISTS_SHELF_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
