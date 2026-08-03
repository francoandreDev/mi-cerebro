import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: mismo patrón genérico que el resto de flujos `*-folders` (§8.86,
//      roadmap-26-tutoriales.md) — crear, navegar, renombrar/mover/borrar
//      vía el diálogo de "⋮". Igual que Notes/Goals: `tasks-garden.container.html`
//      no cablea `(childDragOver)`/`(childDrop)` en `<mc-folder-breadcrumb>` —
//      sólo `(navigate)`, `(createSubfolder)`, `(manageFolder)` — así que no
//      hay gesto de "soltar una tarea sobre una subcarpeta"; ese step se
//      reemplaza por "abrir una subcarpeta con click", verificado contra el
//      código real antes de asumirlo. Diferido en docs/deferred/files-writings-tasks.md
//      desde el ítem 8.9 (que sólo pedía tasks/tasks-patio/tasks-editor).
export const TASKS_FOLDERS_TUTORIAL: TutorialDefinition = {
  id: 'tasks-folders',
  pageId: 'tasks',
  labelKey: 'tasks.tutorial.flow.folders',
  steps: [
    {
      anchorSelector: '[data-tutorial="folder-breadcrumb-add"]',
      titleKey: 'tasks.tutorial.folders.create.title',
      bodyKey: 'tasks.tutorial.folders.create.body',
      action: { event: 'click', icon: 'folder-plus' },
    },
    {
      anchorSelector: '[data-tutorial="folder-breadcrumb-child"]',
      titleKey: 'tasks.tutorial.folders.open.title',
      bodyKey: 'tasks.tutorial.folders.open.body',
      action: {
        event: 'click',
        selector: '[data-tutorial="folder-breadcrumb-child"] .child-open',
        icon: 'folder',
      },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="folder-breadcrumb-child-manage"]',
      titleKey: 'tasks.tutorial.folders.manage.title',
      bodyKey: 'tasks.tutorial.folders.manage.body',
      action: { event: 'click', icon: 'dots-three-vertical' },
      skipIfMissing: true,
      moreDetail: { bodyKey: 'tasks.tutorial.folders.manage.moreDetail' },
    },
    {
      anchorSelector: '[data-tutorial="folder-breadcrumb-root"]',
      titleKey: 'tasks.tutorial.folders.navigate.title',
      bodyKey: 'tasks.tutorial.folders.navigate.body',
      action: { event: 'click', icon: 'folder' },
    },
  ],
};

export function registerTasksFoldersTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(TASKS_FOLDERS_TUTORIAL, { autoStartIfUnseen: false });
  inject(DestroyRef).onDestroy(dispose);
}
