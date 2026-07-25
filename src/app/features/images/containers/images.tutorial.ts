import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: copy dedicado (no reciclado de home-content.ts). Crear una galería
//      navega automáticamente a /images/:id (galleries-index.container.ts),
//      así que subir/pegar y el mini-mapa anclan en la sala real en vez de
//      quedarse en el índice — antes ambos steps re-anclaban de más en
//      `images-new`/`images-plan`, elementos que ya no existen tras crear.
export const IMAGES_TUTORIAL: TutorialDefinition = {
  id: 'images',
  steps: [
    {
      anchorSelector: '[data-tutorial="images-new"]',
      titleKey: 'images.tutorial.create.title',
      bodyKey: 'images.tutorial.create.body',
      action: { event: 'click', icon: 'plus' },
    },
    {
      anchorSelector: '[data-tutorial="images-room"]',
      titleKey: 'images.tutorial.upload.title',
      bodyKey: 'images.tutorial.upload.body',
      action: { event: 'keydown', key: 'v', ctrlOrMeta: true, icon: 'upload-simple' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="images-plan"]',
      titleKey: 'images.tutorial.navigate.title',
      bodyKey: 'images.tutorial.navigate.body',
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="images-room-minimap"]',
      titleKey: 'images.tutorial.minimap.title',
      bodyKey: 'images.tutorial.minimap.body',
      skipIfMissing: true,
    },
  ],
};

export function registerImagesTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(IMAGES_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
