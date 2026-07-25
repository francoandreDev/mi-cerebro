import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: copy dedicado (no reciclado de home-content.ts). Tags/descarga
//      viven adentro del locker abierto — mismo route, pero gateado a que
//      ya se haya subido algo — así que quedan sin `action`.
export const FILES_TUTORIAL: TutorialDefinition = {
  id: 'files',
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
      anchorSelector: '[data-tutorial="files-wall"]',
      titleKey: 'files.tutorial.tags.title',
      bodyKey: 'files.tutorial.tags.body',
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
