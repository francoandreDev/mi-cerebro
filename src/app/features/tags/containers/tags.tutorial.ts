import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: Etiquetas no tiene card propia en home-content.ts — copy nuevo,
//      verificado contra tags.container.html: las etiquetas se crean desde
//      otras entidades (no hay alta acá). Recolor/rename/merge/eliminar
//      viven en el flujo condicional `tags-organize` (registerTagsOrganizeTutorial,
//      tags-organize.tutorial.ts) porque esas filas solo existen con datos —
//      este flujo esencial se queda con lo que siempre está disponible.
export const TAGS_TUTORIAL: TutorialDefinition = {
  id: 'tags',
  pageId: 'tags',
  labelKey: 'tags.tutorial.flow.essentials',
  steps: [
    {
      anchorSelector: '[data-tutorial="tags-header"]',
      titleKey: 'tags.page.title',
      bodyKey: 'tags.tutorial.origin.body',
    },
    {
      anchorSelector: '[data-tutorial="tags-filter"]',
      titleKey: 'tags.tutorial.filter.title',
      bodyKey: 'tags.tutorial.filter.body',
      moreDetail: { bodyKey: 'tags.tutorial.filter.moreDetail' },
    },
    {
      // why: mención de existencia — tag-detail (/tags/:id) no se navega
      //      desde esta lista (no hay routerLink acá), sino desde el chip
      //      de etiqueta que aparece en notas/tareas/metas/etc
      //      (shared/tags/tag-chip.component.ts). Sin gesto propio en esta
      //      página, así que queda sin `action`.
      anchorSelector: '[data-tutorial="tags-header"]',
      titleKey: 'tags.tutorial.detail.title',
      bodyKey: 'tags.tutorial.detail.body',
    },
  ],
};

export function registerTagsTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(TAGS_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
