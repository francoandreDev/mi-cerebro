import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: mismo patrón genérico que el resto de flujos `*-folders` (§8.86,
//      roadmap-26-tutoriales.md) — crear, navegar, renombrar/mover/borrar
//      vía el diálogo de "⋮". Igual que Notes/Goals (no como Books):
//      `chalk-entry.component.ts` no tiene `draggable` ni
//      `lists-shelf.container.html` cablea `(childDragOver)`/`(childDrop)`
//      en `<mc-folder-breadcrumb>` — sólo `(navigate)`, `(createSubfolder)`,
//      `(manageFolder)` — así que no hay gesto de "soltar una lista sobre
//      una subcarpeta"; ese step se reemplaza por "abrir una subcarpeta con
//      click", verificado contra el código real antes de asumir ninguno de
//      los dos casos.
export const LISTS_FOLDERS_TUTORIAL: TutorialDefinition = {
  id: 'lists-folders',
  pageId: 'lists',
  labelKey: 'lists.tutorial.flow.folders',
  steps: [
    {
      anchorSelector: '[data-tutorial="folder-breadcrumb-add"]',
      titleKey: 'lists.tutorial.folders.create.title',
      bodyKey: 'lists.tutorial.folders.create.body',
      action: { event: 'click', icon: 'folder-plus' },
    },
    {
      anchorSelector: '[data-tutorial="folder-breadcrumb-child"]',
      titleKey: 'lists.tutorial.folders.open.title',
      bodyKey: 'lists.tutorial.folders.open.body',
      action: {
        event: 'click',
        selector: '[data-tutorial="folder-breadcrumb-child"] .child-open',
        icon: 'folder',
      },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="folder-breadcrumb-child-manage"]',
      titleKey: 'lists.tutorial.folders.manage.title',
      bodyKey: 'lists.tutorial.folders.manage.body',
      action: { event: 'click', icon: 'dots-three-vertical' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="folder-breadcrumb-root"]',
      titleKey: 'lists.tutorial.folders.navigate.title',
      bodyKey: 'lists.tutorial.folders.navigate.body',
      action: { event: 'click', icon: 'folder' },
    },
  ],
};

export function registerListsFoldersTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(LISTS_FOLDERS_TUTORIAL, { autoStartIfUnseen: false });
  inject(DestroyRef).onDestroy(dispose);
}
