import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: mismo patrón que `goals-folders`/`notes-folders` (§8.86) sobre
//      `shared/folder-breadcrumb/`. FilesContainer no cablea
//      `(childDragOver)`/`(childDrop)` en su `<mc-folder-breadcrumb>` (sin
//      gesto de "soltar sobre subcarpeta" — confirmado contra
//      files.container.html), así que "abrir subcarpeta" se practica con
//      click en vez de drag, igual que Goals.
export const FILES_FOLDERS_TUTORIAL: TutorialDefinition = {
  id: 'files-folders',
  pageId: 'files',
  labelKey: 'files.tutorial.flow.folders',
  steps: [
    {
      anchorSelector: '[data-tutorial="folder-breadcrumb-add"]',
      titleKey: 'files.tutorial.folders.create.title',
      bodyKey: 'files.tutorial.folders.create.body',
      action: { event: 'click', icon: 'folder-plus' },
    },
    {
      anchorSelector: '[data-tutorial="folder-breadcrumb-child"]',
      titleKey: 'files.tutorial.folders.open.title',
      bodyKey: 'files.tutorial.folders.open.body',
      action: {
        event: 'click',
        selector: '[data-tutorial="folder-breadcrumb-child"] .child-open',
        icon: 'folder',
      },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="folder-breadcrumb-child-manage"]',
      titleKey: 'files.tutorial.folders.manage.title',
      bodyKey: 'files.tutorial.folders.manage.body',
      action: { event: 'click', icon: 'dots-three-vertical' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="folder-breadcrumb-root"]',
      titleKey: 'files.tutorial.folders.navigate.title',
      bodyKey: 'files.tutorial.folders.navigate.body',
      action: { event: 'click', icon: 'folder' },
    },
  ],
};

export function registerFilesFoldersTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(FILES_FOLDERS_TUTORIAL, { autoStartIfUnseen: false });
  inject(DestroyRef).onDestroy(dispose);
}
