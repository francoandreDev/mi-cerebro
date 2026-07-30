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
  pageId: 'images',
  steps: [
    // why: skipIfMissing porque el tutorial ahora también se registra desde
    //      GalleriesContainer (/images/:id) para que "Guía de la página" no
    //      desaparezca dentro de una sala — este anchor solo existe en el
    //      índice (/images), así que arrancar el flujo estando ya adentro
    //      de una galería debe saltar directo al siguiente step en vez de
    //      dejar la tarjeta flotando sin spotlight.
    {
      anchorSelector: '[data-tutorial="images-new"]',
      titleKey: 'images.tutorial.create.title',
      bodyKey: 'images.tutorial.create.body',
      action: { event: 'click', icon: 'plus' },
      moreDetail: { bodyKey: 'images.tutorial.create.moreDetail' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="images-room"]',
      titleKey: 'images.tutorial.upload.title',
      bodyKey: 'images.tutorial.upload.body',
      action: { event: 'keydown', key: 'v', ctrlOrMeta: true, icon: 'upload-simple' },
      skipIfMissing: true,
      moreDetail: { bodyKey: 'images.tutorial.upload.moreDetail' },
    },
    {
      anchorSelector: '[data-tutorial="images-frame-open"]',
      titleKey: 'images.tutorial.open.title',
      bodyKey: 'images.tutorial.open.body',
      action: { event: 'click', icon: 'eye' },
      skipIfMissing: true,
    },
    // why: gesto destructivo por foto — el borrado de la galería entera vive
    //      en otro anchor (menú "⋯" de gallery-meta-bar), no en el frame.
    {
      anchorSelector: '[data-tutorial="images-frame-delete"]',
      titleKey: 'images.tutorial.deleteImage.title',
      bodyKey: 'images.tutorial.deleteImage.body',
      action: { event: 'click', icon: 'trash' },
      tier: 'avanzado',
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
      moreDetail: { bodyKey: 'images.tutorial.minimap.moreDetail' },
    },
    // why: "Eliminar" es la única opción del menú "⋯" (gallery-meta-bar.
    //      component.ts#menuOptions) — el click que lo abre es el gesto
    //      practicable, igual que files.tutorial.deleteCollection.
    {
      anchorSelector: '[data-tutorial="images-gallery-menu"]',
      titleKey: 'images.tutorial.deleteGallery.title',
      bodyKey: 'images.tutorial.deleteGallery.body',
      action: { event: 'click', icon: 'dots-three-vertical' },
      tier: 'avanzado',
      skipIfMissing: true,
      moreDetail: { bodyKey: 'images.tutorial.deleteGallery.moreDetail' },
    },
  ],
};

export function registerImagesTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(IMAGES_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
