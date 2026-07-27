import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: copy dedicado (no reciclado de home-content.ts). Los atajos del
//      lector viven en /books/:id/leer (otra ruta, gateada a que exista un
//      libro) — antes los 4 (PageUp/Down, Alt+←/→, Ctrl+., Ctrl+') estaban
//      empaquetados en un solo step sin anchor real ni action (anti-patrón
//      que la propia regla §4.6.15b nombra como lo que evitar). Ahora son 4
//      steps, cada uno anclado a un elemento real de book-reader.container.html
//      y practicable con su atajo.
export const BOOKS_TUTORIAL: TutorialDefinition = {
  id: 'books',
  pageId: 'books',
  labelKey: 'books.tutorial.flow.essentials',
  steps: [
    {
      anchorSelector: '[data-tutorial="books-shelf"]',
      titleKey: 'books.tutorial.upload.title',
      bodyKey: 'books.tutorial.upload.body',
      action: { event: 'click', selector: '[data-tutorial="books-new"]', icon: 'plus' },
    },
    {
      anchorSelector: '[data-tutorial="books-shelf"]',
      titleKey: 'books.tutorial.organize.title',
      bodyKey: 'books.tutorial.organize.body',
      action: { event: 'dragstart', icon: 'arrows-clockwise' },
    },
    {
      anchorSelector: '[data-tutorial="books-density"]',
      titleKey: 'books.tutorial.density.title',
      bodyKey: 'books.tutorial.density.body',
      action: { event: 'click', icon: 'rows' },
      moreDetail: { bodyKey: 'books.tutorial.density.moreDetail' },
    },
    // why: mención de existencia — el catálogo/índice global es demasiado
    //      versátil (buscar por cualquier estante) para tener un gesto
    //      único a practicar, así que se menciona sin `action` (§8.85 2b).
    {
      anchorSelector: '[data-tutorial="books-catalog"]',
      titleKey: 'books.tutorial.catalog.title',
      bodyKey: 'books.tutorial.catalog.body',
      tier: 'avanzado',
    },
    {
      anchorSelector: '[data-tutorial="books-shelf"]',
      titleKey: 'books.tutorial.open.title',
      bodyKey: 'books.tutorial.open.body',
      action: { event: 'click', icon: 'arrow-square-out' },
      moreDetail: { bodyKey: 'books.tutorial.open.moreDetail' },
    },
    {
      anchorSelector: '[data-tutorial="books-reader-pane"]',
      titleKey: 'books.tutorial.readerPaging.title',
      bodyKey: 'books.tutorial.readerPaging.body',
      action: { event: 'keydown', key: 'pagedown', icon: 'arrow-down' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="books-reader-nav"]',
      titleKey: 'books.tutorial.readerChapterNav.title',
      bodyKey: 'books.tutorial.readerChapterNav.body',
      action: { event: 'keydown', key: 'arrowright', altKey: true, icon: 'arrow-right' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="books-reader-pane"]',
      titleKey: 'books.tutorial.readerFocus.title',
      bodyKey: 'books.tutorial.readerFocus.body',
      action: { event: 'keydown', key: '.', ctrlOrMeta: true, icon: 'eye' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="books-reader-toc"]',
      titleKey: 'books.tutorial.readerToc.title',
      bodyKey: 'books.tutorial.readerToc.body',
      action: { event: 'click', icon: 'list-bullets' },
      skipIfMissing: true,
    },
  ],
};

export function registerBooksTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(BOOKS_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
