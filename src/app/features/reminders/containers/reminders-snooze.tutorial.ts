import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: §8.89 — el menú `⋮` (overflow) nunca tuvo tutorial propio: 4
//      presets de snooze + duplicar + eliminar, todos reales gestos de
//      `reminders.container.ts`. El menú se cierra solo tras cualquier
//      click de sus botones (`overflowOpenId.set(null)` en cada handler:
//      `onSnooze`/`onSnoozeNextMonday`/`onSnoozeWeekend`/`onDuplicate`/
//      `onDelete`), así que los 4 presets de snooze se agrupan en un
//      único step descriptivo (sin `action`, el menú sigue abierto porque
//      ese step no lo cierra) — practicar uno solo cerraría el menú antes
//      de leer los otros tres. Duplicar sí es un `action` real; como eso
//      cierra el menú, hay un step explícito de reabrirlo antes de
//      eliminar (mismo gesto que abrirlo la primera vez, pero nombrado
//      aparte porque la razón de repetirlo — "se cierra solo" — es
//      información real que el usuario necesita, no relleno).
export const REMINDERS_SNOOZE_TUTORIAL: TutorialDefinition = {
  id: 'reminders-snooze',
  pageId: 'reminders',
  labelKey: 'reminders.tutorial.flow.snooze',
  steps: [
    {
      anchorSelector: '[data-tutorial="reminders-palomar"]',
      titleKey: 'reminders.tutorial.snooze.openDetail.title',
      bodyKey: 'reminders.tutorial.snooze.openDetail.body',
      action: { event: 'click', icon: 'pencil-simple' },
    },
    {
      anchorSelector: '[data-tutorial="reminder-overflow-toggle"]',
      titleKey: 'reminders.tutorial.snooze.openOverflow.title',
      bodyKey: 'reminders.tutorial.snooze.openOverflow.body',
      action: { event: 'click', icon: 'dots-three-vertical' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="reminder-overflow-menu"]',
      titleKey: 'reminders.tutorial.snooze.options.title',
      bodyKey: 'reminders.tutorial.snooze.options.body',
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="reminder-duplicate"]',
      titleKey: 'reminders.tutorial.snooze.duplicate.title',
      bodyKey: 'reminders.tutorial.snooze.duplicate.body',
      action: { event: 'click', icon: 'copy' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="reminder-overflow-toggle"]',
      titleKey: 'reminders.tutorial.snooze.reopenOverflow.title',
      bodyKey: 'reminders.tutorial.snooze.reopenOverflow.body',
      action: { event: 'click', icon: 'dots-three-vertical' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="reminder-delete"]',
      titleKey: 'reminders.tutorial.snooze.delete.title',
      bodyKey: 'reminders.tutorial.snooze.delete.body',
      action: { event: 'click', icon: 'trash' },
      skipIfMissing: true,
    },
  ],
};

export function registerRemindersSnoozeTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(REMINDERS_SNOOZE_TUTORIAL, { autoStartIfUnseen: false });
  inject(DestroyRef).onDestroy(dispose);
}
