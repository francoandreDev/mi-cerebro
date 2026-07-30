import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: copy dedicado (no reciclado de home-content.ts). Tags ahora ancla al
//      picker real (antes apuntaba a la pared) con `action` de click para
//      empezar a agregar un tag — completar el tag requiere escribir texto,
//      que el engine no soporta como gesto detectable, así que el click de
//      apertura es el gesto concreto practicable (mismo criterio que
//      `goal-peek-rename`: click abre el modo edición, no completa el
//      gesto entero). La descarga sigue siendo mención sin `action` — vive
//      adentro del locker abierto, gateada a que ya haya un archivo subido.
//      §8.12 (re-scoped por 8.85).
export const FILES_TUTORIAL: TutorialDefinition = {
  id: 'files',
  pageId: 'files',
  labelKey: 'files.tutorial.flow.essentials',
  steps: [
    {
      anchorSelector: '[data-tutorial="files-new"]',
      titleKey: 'files.tutorial.upload.title',
      bodyKey: 'files.tutorial.upload.body',
      action: { event: 'click', icon: 'plus' },
    },
    {
      anchorSelector: '[data-tutorial="files-wall"]',
      titleKey: 'files.tutorial.open.title',
      bodyKey: 'files.tutorial.open.body',
      action: { event: 'click', icon: 'folder-open' },
    },
    {
      anchorSelector: '[data-tutorial="files-tag-picker"]',
      titleKey: 'files.tutorial.tags.title',
      bodyKey: 'files.tutorial.tags.body',
      action: {
        event: 'click',
        selector: '[data-tutorial="files-tag-picker"] input',
        icon: 'plus',
      },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="files-item-board"]',
      titleKey: 'files.tutorial.reorder.title',
      bodyKey: 'files.tutorial.reorder.body',
      action: { event: 'dragstart', icon: 'arrows-clockwise' },
      skipIfMissing: true,
      tier: 'avanzado',
    },
    {
      anchorSelector: '[data-tutorial="file-artifact-rename"]',
      titleKey: 'files.tutorial.renameItem.title',
      bodyKey: 'files.tutorial.renameItem.body',
      action: { event: 'click', icon: 'pencil-simple' },
      skipIfMissing: true,
      tier: 'avanzado',
    },
    {
      anchorSelector: '[data-tutorial="files-title-input"]',
      titleKey: 'files.tutorial.editTitle.title',
      bodyKey: 'files.tutorial.editTitle.body',
      action: { event: 'click', icon: 'pencil-simple' },
      skipIfMissing: true,
      tier: 'avanzado',
    },
    {
      anchorSelector: '[data-tutorial="files-collection-menu"]',
      titleKey: 'files.tutorial.deleteCollection.title',
      bodyKey: 'files.tutorial.deleteCollection.body',
      action: {
        event: 'click',
        selector: '[data-tutorial="files-collection-menu"] .item',
        icon: 'trash',
      },
      skipIfMissing: true,
      tier: 'avanzado',
    },
    {
      anchorSelector: '[data-tutorial="files-wall"]',
      titleKey: 'files.tutorial.download.title',
      bodyKey: 'files.tutorial.download.body',
    },
  ],
};

export function registerFilesTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(FILES_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
