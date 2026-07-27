import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: toolbar propia de Books (`chapter-editor-pane.component.html`), no
//      la de `shared/editor/editor-toolbar.component.ts` — la paginación
//      del libro esconde la del editor compartido y reimplementa los
//      mismos botones en su propia `ui-bar` (ver comentario en el
//      componente). Steps agrupados por categoría: formato de texto,
//      estructura, media, typewriter+stats — un gesto real por step
//      (§4.6.15b), moreDetail para el botón hermano de cada grupo.
export const BOOKS_EDITOR_ADVANCED_TUTORIAL: TutorialDefinition = {
  id: 'books-editor-advanced',
  pageId: 'books',
  labelKey: 'books.tutorial.flow.editorAdvanced',
  steps: [
    {
      anchorSelector: '[data-tutorial="books-editor-format"]',
      titleKey: 'books.tutorial.editorAdvanced.format.title',
      bodyKey: 'books.tutorial.editorAdvanced.format.body',
      action: { event: 'click', icon: 'text-b' },
      moreDetail: { bodyKey: 'books.tutorial.editorAdvanced.format.moreDetail' },
    },
    {
      anchorSelector: '[data-tutorial="books-editor-heading"]',
      titleKey: 'books.tutorial.editorAdvanced.heading.title',
      bodyKey: 'books.tutorial.editorAdvanced.heading.body',
      action: { event: 'click', icon: 'text-h-two' },
      moreDetail: { bodyKey: 'books.tutorial.editorAdvanced.heading.moreDetail' },
    },
    {
      anchorSelector: '[data-tutorial="books-editor-citation"]',
      titleKey: 'books.tutorial.editorAdvanced.citation.title',
      bodyKey: 'books.tutorial.editorAdvanced.citation.body',
      action: { event: 'click', icon: 'quotes' },
    },
    {
      anchorSelector: '[data-tutorial="books-editor-list"]',
      titleKey: 'books.tutorial.editorAdvanced.list.title',
      bodyKey: 'books.tutorial.editorAdvanced.list.body',
      action: { event: 'click', icon: 'list-bullets' },
      moreDetail: { bodyKey: 'books.tutorial.editorAdvanced.list.moreDetail' },
    },
    {
      anchorSelector: '[data-tutorial="books-editor-scene-break"]',
      titleKey: 'books.tutorial.editorAdvanced.sceneBreak.title',
      bodyKey: 'books.tutorial.editorAdvanced.sceneBreak.body',
      action: { event: 'click', icon: 'minus' },
    },
    // why: sólo visible cuando ya existe al menos una galería de imágenes
    //      (hasImageGalleries()) — el botón ni siquiera está en el DOM
    //      hasta entonces.
    {
      anchorSelector: '[data-tutorial="books-editor-insert-image"]',
      titleKey: 'books.tutorial.editorAdvanced.image.title',
      bodyKey: 'books.tutorial.editorAdvanced.image.body',
      action: { event: 'click', icon: 'image' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="books-editor-typewriter"]',
      titleKey: 'books.tutorial.editorAdvanced.typewriter.title',
      bodyKey: 'books.tutorial.editorAdvanced.typewriter.body',
      action: { event: 'click', icon: 'target' },
    },
    {
      anchorSelector: '[data-tutorial="books-editor-stats"]',
      titleKey: 'books.tutorial.editorAdvanced.stats.title',
      bodyKey: 'books.tutorial.editorAdvanced.stats.body',
      action: { event: 'click', icon: 'chart-line' },
    },
  ],
};

export function registerBooksEditorAdvancedTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(BOOKS_EDITOR_ADVANCED_TUTORIAL, {
    autoStartIfUnseen: false,
  });
  inject(DestroyRef).onDestroy(dispose);
}
