import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: Alt+C/Alt+P son globales (document keydown, ver
//      `shared/editor/editor.component.ts`) y sólo hacen algo con una
//      selección de texto activa — el gesto real (bubble menu) es efímero
//      y sólo existe con selección, así que el anchor es el editor-host
//      (siempre presente) en vez del bubble, mismo motivo por el que el
//      `action` escucha el atajo (keydown) y no un click sobre un botón
//      que puede no estar montado. Sin `route`: se registra dentro de
//      `NotesContainer` (`/notes/:id`), mismo patrón que
//      `books-collab`/`books-tts` (tampoco llevan `route`). Notes NO tiene
//      TTS ni bookmarks (`TtsService` sólo lo consume
//      `book-reader.container.ts`, y `bookmarkable` en `mc-editor` es
//      opt-in, sin setear en `note-editor-pane.component.ts`) — el nombre
//      del flujo dropea "y voz" del roadmap original (§8.8) para no
//      prometer una función que no existe (regla: la UI no miente). El
//      banner de lock concurrente (§4.16) cierra el flujo como
//      `tier: 'avanzado'`, sin `action` — es informativo, no un gesto.
export const NOTES_DRAFTS_TUTORIAL: TutorialDefinition = {
  id: 'notes-drafts',
  pageId: 'notes',
  labelKey: 'notes.tutorial.flow.drafts',
  steps: [
    {
      anchorSelector: '[data-tutorial="editor-host"]',
      titleKey: 'notes.tutorial.drafts.comment.title',
      bodyKey: 'notes.tutorial.drafts.comment.body',
      action: { event: 'keydown', key: 'c', altKey: true, icon: 'chat-circle' },
    },
    {
      anchorSelector: '[data-tutorial="editor-host"]',
      titleKey: 'notes.tutorial.drafts.propose.title',
      bodyKey: 'notes.tutorial.drafts.propose.body',
      action: { event: 'keydown', key: 'p', altKey: true, icon: 'git-branch' },
    },
    {
      anchorSelector: '[data-tutorial="editor-toolbar-view-combined"]',
      titleKey: 'notes.tutorial.drafts.combinedView.title',
      bodyKey: 'notes.tutorial.drafts.combinedView.body',
      action: { event: 'click', icon: 'squares-four' },
    },
    {
      anchorSelector: '[data-tutorial="editor-toolbar-comments-index"]',
      titleKey: 'notes.tutorial.drafts.index.title',
      bodyKey: 'notes.tutorial.drafts.index.body',
      action: { event: 'click', icon: 'chat-circle' },
      skipIfMissing: true,
      moreDetail: { bodyKey: 'notes.tutorial.drafts.index.moreDetail' },
    },
    {
      anchorSelector: '[data-tutorial="notes-lock-banner"]',
      titleKey: 'notes.tutorial.drafts.lock.title',
      bodyKey: 'notes.tutorial.drafts.lock.body',
      skipIfMissing: true,
      tier: 'avanzado',
    },
  ],
};

export function registerNotesDraftsTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(NOTES_DRAFTS_TUTORIAL, { autoStartIfUnseen: false });
  inject(DestroyRef).onDestroy(dispose);
}
