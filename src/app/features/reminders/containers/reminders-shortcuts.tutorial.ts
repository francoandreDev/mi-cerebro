import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: §8.89 — el sistema completo de atajos (j/k/e/espacio/Supr/N,
//      registrados en `RemindersContainer.registerShortcuts`, scope
//      `editable-safe`) nunca tuvo tutorial propio; el tutorial esencial
//      solo menciona N de pasada en el botón "+ Nuevo". Cada tecla es un
//      `keydown` sin modificador, mismo patrón sin `ctrlOrMeta` que
//      `music.tutorial.ts` (Espacio, `/`). Ancladas en el palomar (siempre
//      presente, incluso vacío) salvo la última, que reusa el ancla del
//      quick-add ya cubierta por `reminders.tutorial.ts`.
export const REMINDERS_SHORTCUTS_TUTORIAL: TutorialDefinition = {
  id: 'reminders-shortcuts',
  pageId: 'reminders',
  labelKey: 'reminders.tutorial.flow.shortcuts',
  steps: [
    {
      anchorSelector: '[data-tutorial="reminders-palomar"]',
      titleKey: 'reminders.tutorial.shortcuts.next.title',
      bodyKey: 'reminders.tutorial.shortcuts.next.body',
      action: { event: 'keydown', key: 'j', icon: 'arrow-down' },
    },
    {
      anchorSelector: '[data-tutorial="reminders-palomar"]',
      titleKey: 'reminders.tutorial.shortcuts.prev.title',
      bodyKey: 'reminders.tutorial.shortcuts.prev.body',
      action: { event: 'keydown', key: 'k', icon: 'arrow-up' },
    },
    {
      anchorSelector: '[data-tutorial="reminders-palomar"]',
      titleKey: 'reminders.tutorial.shortcuts.open.title',
      bodyKey: 'reminders.tutorial.shortcuts.open.body',
      action: { event: 'keydown', key: 'e', icon: 'arrow-square-out' },
    },
    {
      anchorSelector: '[data-tutorial="reminders-palomar"]',
      titleKey: 'reminders.tutorial.shortcuts.toggleDone.title',
      bodyKey: 'reminders.tutorial.shortcuts.toggleDone.body',
      action: { event: 'keydown', key: ' ', icon: 'check' },
    },
    {
      anchorSelector: '[data-tutorial="reminders-palomar"]',
      titleKey: 'reminders.tutorial.shortcuts.delete.title',
      bodyKey: 'reminders.tutorial.shortcuts.delete.body',
      action: { event: 'keydown', key: 'Delete', icon: 'trash' },
    },
    {
      anchorSelector: '[data-tutorial="reminders-quick-add"]',
      titleKey: 'reminders.tutorial.shortcuts.new.title',
      bodyKey: 'reminders.tutorial.shortcuts.new.body',
      action: { event: 'keydown', key: 'n', icon: 'plus' },
    },
  ],
};

export function registerRemindersShortcutsTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(REMINDERS_SHORTCUTS_TUTORIAL, { autoStartIfUnseen: false });
  inject(DestroyRef).onDestroy(dispose);
}
