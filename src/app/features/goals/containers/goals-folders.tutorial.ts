import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: mismo patrón genérico que el resto de flujos `*-folders` (§8.86,
//      roadmap-26-tutoriales.md) — crear, navegar, renombrar/mover/borrar
//      vía el diálogo de "⋮". Igual que Notes (no como Books): las estrellas
//      de la wall (`goals-wall.container.html`) no tienen `draggable` ni
//      `goals-wall.container.ts` cablea `(childDragOver)`/`(childDrop)` en
//      `<mc-folder-breadcrumb>` — sólo `(navigate)`, `(createSubfolder)`,
//      `(manageFolder)` — así que no hay gesto de "soltar una meta sobre
//      una subcarpeta"; ese step se reemplaza por "abrir una subcarpeta con
//      click", verificado contra el código real antes de asumir ninguno de
//      los dos casos.
export const GOALS_FOLDERS_TUTORIAL: TutorialDefinition = {
  id: 'goals-folders',
  pageId: 'goals',
  labelKey: 'goals.tutorial.flow.folders',
  steps: [
    {
      anchorSelector: '[data-tutorial="folder-breadcrumb-add"]',
      titleKey: 'goals.tutorial.folders.create.title',
      bodyKey: 'goals.tutorial.folders.create.body',
      action: { event: 'click', icon: 'folder-plus' },
    },
    {
      anchorSelector: '[data-tutorial="folder-breadcrumb-child"]',
      titleKey: 'goals.tutorial.folders.open.title',
      bodyKey: 'goals.tutorial.folders.open.body',
      action: {
        event: 'click',
        selector: '[data-tutorial="folder-breadcrumb-child"] .child-open',
        icon: 'folder',
      },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="folder-breadcrumb-child-manage"]',
      titleKey: 'goals.tutorial.folders.manage.title',
      bodyKey: 'goals.tutorial.folders.manage.body',
      action: { event: 'click', icon: 'dots-three-vertical' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="folder-breadcrumb-root"]',
      titleKey: 'goals.tutorial.folders.navigate.title',
      bodyKey: 'goals.tutorial.folders.navigate.body',
      action: { event: 'click', icon: 'folder' },
    },
  ],
};

export function registerGoalsFoldersTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(GOALS_FOLDERS_TUTORIAL, { autoStartIfUnseen: false });
  inject(DestroyRef).onDestroy(dispose);
}
