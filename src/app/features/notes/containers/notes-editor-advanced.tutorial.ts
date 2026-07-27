import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: a diferencia de Books (toolbar propia, oculta la de
//      `shared/editor/editor-toolbar.component.ts`), Notes usa el toolbar
//      compartido tal cual — así que estos anchors (`editor-toolbar-*`) son
//      genéricos, no prefijados `notes-`, y cualquier otra feature que use
//      `mc-editor` los hereda gratis. Sin `route`: este flujo sólo se
//      registra dentro de `NotesContainer`, que ya vive en `/notes/:id` —
//      el picker únicamente aparece con una nota abierta, mismo patrón que
//      `books-editor-advanced` (tampoco lleva `route`). Agrupado en 2 steps
//      por categoría (texto / estructura y media), no un step por botón —
//      `moreDetail` cubre el resto de cada grupo (§8.8, roadmap).
export const NOTES_EDITOR_ADVANCED_TUTORIAL: TutorialDefinition = {
  id: 'notes-editor-advanced',
  pageId: 'notes',
  labelKey: 'notes.tutorial.flow.editorAdvanced',
  steps: [
    {
      anchorSelector: '[data-tutorial="editor-toolbar-format"]',
      titleKey: 'notes.tutorial.editorAdvanced.format.title',
      bodyKey: 'notes.tutorial.editorAdvanced.format.body',
      action: { event: 'click', icon: 'text-b' },
      moreDetail: { bodyKey: 'notes.tutorial.editorAdvanced.format.moreDetail' },
    },
    {
      anchorSelector: '[data-tutorial="editor-toolbar-structure"]',
      titleKey: 'notes.tutorial.editorAdvanced.structure.title',
      bodyKey: 'notes.tutorial.editorAdvanced.structure.body',
      action: { event: 'click', icon: 'minus' },
      moreDetail: { bodyKey: 'notes.tutorial.editorAdvanced.structure.moreDetail' },
    },
    // why: sólo visible cuando ya existe al menos una galería de imágenes
    //      (hasGalleries()) — el botón ni siquiera está en el DOM hasta
    //      entonces, mismo caso que `books-editor-insert-image`.
    {
      anchorSelector: '[data-tutorial="editor-toolbar-insert-image"]',
      titleKey: 'notes.tutorial.editorAdvanced.image.title',
      bodyKey: 'notes.tutorial.editorAdvanced.image.body',
      action: { event: 'click', icon: 'image' },
      skipIfMissing: true,
    },
  ],
};

export function registerNotesEditorAdvancedTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(NOTES_EDITOR_ADVANCED_TUTORIAL, { autoStartIfUnseen: false });
  inject(DestroyRef).onDestroy(dispose);
}
