import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: `/tasks/:id` no tiene id fijo para navegar con `TutorialStep.route`
//      (`router.navigateByUrl` necesita una URL literal) — igual que
//      `notes-editor-advanced`/`goals-constellation`, se registra directo
//      acá, montado solo cuando ya hay una tarea abierta, así que sólo
//      aparece en el picker "Guía de la página" en ese momento.
export const TASKS_EDITOR_TUTORIAL: TutorialDefinition = {
  id: 'tasks-editor',
  pageId: 'tasks',
  labelKey: 'tasks.tutorial.flow.editor',
  steps: [
    {
      anchorSelector: '[data-tutorial="tasks-editor-reminder"]',
      titleKey: 'tasks.tutorial.editor.reminder.title',
      bodyKey: 'tasks.tutorial.editor.reminder.body',
      action: {
        event: 'click',
        selector: '[data-tutorial="tasks-editor-reminder"] input',
        icon: 'bell',
      },
    },
    // why: agregar un tag es escribir en un input de búsqueda/creación
    //      (`shared/tags/tag-picker.component.ts`) — no hay un solo click
    //      detectable (mismo caso que `tags.tutorial.ts`), queda
    //      descriptivo, sin `action`.
    {
      anchorSelector: '[data-tutorial="tasks-editor-tags"]',
      titleKey: 'tasks.tutorial.editor.tags.title',
      bodyKey: 'tasks.tutorial.editor.tags.body',
    },
    {
      anchorSelector: '[data-tutorial="editor-host"]',
      titleKey: 'tasks.tutorial.editor.focus.title',
      bodyKey: 'tasks.tutorial.editor.focus.body',
      action: { event: 'keydown', key: 'f', shiftKey: true, altKey: true, icon: 'eye' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="tasks-editor-delete"]',
      titleKey: 'tasks.tutorial.editor.delete.title',
      bodyKey: 'tasks.tutorial.editor.delete.body',
      action: { event: 'click', icon: 'trash' },
      skipIfMissing: true,
    },
  ],
};

export function registerTasksEditorTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(TASKS_EDITOR_TUTORIAL, { autoStartIfUnseen: false });
  inject(DestroyRef).onDestroy(dispose);
}
