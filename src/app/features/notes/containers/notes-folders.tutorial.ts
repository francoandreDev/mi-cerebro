import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: mismo patrón genérico que el resto de flujos `*-folders` (§8.86,
//      roadmap-26-tutoriales.md) — crear, navegar, renombrar/mover/borrar
//      vía el diálogo de "⋮". A diferencia de Books, Notes no tiene un
//      gesto de "soltar la entidad sobre una subcarpeta" (el muro de notas
//      no expone drag-drop hacia `mc-folder-breadcrumb` — el container no
//      cablea `(childDragOver)`/`(childDrop)`, sólo `(navigate)`,
//      `(createSubfolder)`, `(manageFolder)`), así que ese step se
//      reemplaza por "abrir una subcarpeta con click". El step de
//      scheduling vive físicamente en `/notes/:id` (`notes-schedule` en
//      `note-editor-pane.component.ts`), no en el muro donde se registra
//      este flujo — sin un id fijo no hay `route` posible (a diferencia de
//      home-flows, que navegan a rutas fijas), así que queda con
//      `skipIfMissing: true`: si el usuario corre el flujo sin una nota
//      abierta, este último step se salta solo.
export const NOTES_FOLDERS_TUTORIAL: TutorialDefinition = {
  id: 'notes-folders',
  pageId: 'notes',
  labelKey: 'notes.tutorial.flow.folders',
  steps: [
    {
      anchorSelector: '[data-tutorial="folder-breadcrumb-add"]',
      titleKey: 'notes.tutorial.folders.create.title',
      bodyKey: 'notes.tutorial.folders.create.body',
      action: { event: 'click', icon: 'folder-plus' },
    },
    {
      anchorSelector: '[data-tutorial="folder-breadcrumb-child"]',
      titleKey: 'notes.tutorial.folders.open.title',
      bodyKey: 'notes.tutorial.folders.open.body',
      action: {
        event: 'click',
        selector: '[data-tutorial="folder-breadcrumb-child"] .child-open',
        icon: 'folder',
      },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="folder-breadcrumb-child-manage"]',
      titleKey: 'notes.tutorial.folders.manage.title',
      bodyKey: 'notes.tutorial.folders.manage.body',
      action: { event: 'click', icon: 'dots-three-vertical' },
      skipIfMissing: true,
      moreDetail: { bodyKey: 'notes.tutorial.folders.manage.moreDetail' },
    },
    {
      anchorSelector: '[data-tutorial="folder-breadcrumb-root"]',
      titleKey: 'notes.tutorial.folders.navigate.title',
      bodyKey: 'notes.tutorial.folders.navigate.body',
      action: { event: 'click', icon: 'folder' },
    },
    {
      anchorSelector: '[data-tutorial="notes-schedule"]',
      titleKey: 'notes.tutorial.folders.schedule.title',
      bodyKey: 'notes.tutorial.folders.schedule.body',
      action: { event: 'click', icon: 'calendar-blank' },
      skipIfMissing: true,
      tier: 'avanzado',
    },
  ],
};

export function registerNotesFoldersTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(NOTES_FOLDERS_TUTORIAL, { autoStartIfUnseen: false });
  inject(DestroyRef).onDestroy(dispose);
}
