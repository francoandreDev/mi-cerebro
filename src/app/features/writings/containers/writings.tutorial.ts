import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: copy dedicado (no reciclado de home-content.ts). El editor,
//      fecha límite/recordatorio, tags, autosave, modo foco y borrar viven
//      en /writings/:id (otra ruta, gateada a que exista un escrito), así
//      que esos steps van `skipIfMissing: true`. Borrar es `tier:
//      'avanzado'` — el click abre el `mc-confirm-dialog` (no borra
//      directo), mismo patrón seguro que `goals.tutorial.peekDelete`.
//      Typewriter mode es infraestructura compartida del editor
//      (`shared/editor/editor-toolbar.component.ts`, anchor genérico
//      `editor-toolbar-typewriter` reutilizable por cualquier feature con
//      `mc-editor`, mismo criterio que `editor-toolbar-format` en
//      `notes-editor-advanced.tutorial.ts`) — se menciona sin `action`
//      porque no es un gesto propio de Writings (§8.92).
export const WRITINGS_TUTORIAL: TutorialDefinition = {
  id: 'writings',
  pageId: 'writings',
  labelKey: 'writings.tutorial.flow.essentials',
  steps: [
    {
      anchorSelector: '[data-tutorial="writings-new"]',
      titleKey: 'writings.tutorial.create.title',
      bodyKey: 'writings.tutorial.create.body',
      action: { event: 'submit', icon: 'plus' },
    },
    {
      anchorSelector: '[data-tutorial="writings-editor"]',
      titleKey: 'writings.tutorial.editor.title',
      bodyKey: 'writings.tutorial.editor.body',
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="writings-editor-deadline"]',
      titleKey: 'writings.tutorial.deadline.title',
      bodyKey: 'writings.tutorial.deadline.body',
      action: { event: 'click', icon: 'calendar-dots' },
      moreDetail: { bodyKey: 'writings.tutorial.deadline.moreDetail' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="writings-editor-tags"]',
      titleKey: 'writings.tutorial.tags.title',
      bodyKey: 'writings.tutorial.tags.body',
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="writings-editor"]',
      titleKey: 'writings.tutorial.autosave.title',
      bodyKey: 'writings.tutorial.autosave.body',
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="writings-editor"]',
      titleKey: 'writings.tutorial.focus.title',
      bodyKey: 'writings.tutorial.focus.body',
      action: { event: 'keydown', key: 'f', shiftKey: true, altKey: true, icon: 'eye' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="editor-toolbar-typewriter"]',
      titleKey: 'writings.tutorial.typewriter.title',
      bodyKey: 'writings.tutorial.typewriter.body',
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="writings-editor-delete"]',
      titleKey: 'writings.tutorial.delete.title',
      bodyKey: 'writings.tutorial.delete.body',
      action: { event: 'click', icon: 'trash' },
      tier: 'avanzado',
      skipIfMissing: true,
    },
  ],
};

export function registerWritingsTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(WRITINGS_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
