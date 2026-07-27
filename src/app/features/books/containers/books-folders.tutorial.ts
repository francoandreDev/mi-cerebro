import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: mismo patrón genérico que el resto de flujos `*-folders` (§8.86,
//      roadmap-26-tutoriales.md) — crear, mover, navegar por breadcrumb —
//      más el gesto propio de Books: soltar un libro sobre una subcarpeta
//      desde el estante. Anchors viven en el `shared/folder-breadcrumb/`
//      reusado por varias features; sólo hay una instancia montada por
//      ruta a la vez, así que el selector genérico no colisiona.
export const BOOKS_FOLDERS_TUTORIAL: TutorialDefinition = {
  id: 'books-folders',
  pageId: 'books',
  labelKey: 'books.tutorial.flow.folders',
  steps: [
    {
      anchorSelector: '[data-tutorial="folder-breadcrumb-add"]',
      titleKey: 'books.tutorial.folders.create.title',
      bodyKey: 'books.tutorial.folders.create.body',
      action: { event: 'click', icon: 'folder-plus' },
    },
    {
      anchorSelector: '[data-tutorial="folder-breadcrumb-child"]',
      titleKey: 'books.tutorial.folders.drop.title',
      bodyKey: 'books.tutorial.folders.drop.body',
      action: {
        event: 'dragstart',
        selector: '[data-tutorial="books-shelf"]',
        icon: 'arrows-clockwise',
      },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="folder-breadcrumb-child-manage"]',
      titleKey: 'books.tutorial.folders.manage.title',
      bodyKey: 'books.tutorial.folders.manage.body',
      action: { event: 'click', icon: 'dots-three-vertical' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="folder-breadcrumb-root"]',
      titleKey: 'books.tutorial.folders.navigate.title',
      bodyKey: 'books.tutorial.folders.navigate.body',
      action: { event: 'click', icon: 'folder' },
    },
  ],
};

export function registerBooksFoldersTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(BOOKS_FOLDERS_TUTORIAL, { autoStartIfUnseen: false });
  inject(DestroyRef).onDestroy(dispose);
}
