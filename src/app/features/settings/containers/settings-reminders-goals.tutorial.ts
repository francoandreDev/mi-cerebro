import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: 3 tabs livianas de Settings agrupadas por patrón (toggles/campos
//      simples, §8.10 roadmap-26-tutoriales.md). Mismo motivo que
//      `settings-remote-versioning.tutorial.ts` para anclar en el botón de
//      la tab (`settings-tab-<id>`) en vez del contenido del panel.
export const SETTINGS_REMINDERS_GOALS_TUTORIAL: TutorialDefinition = {
  id: 'settings-reminders-goals',
  pageId: 'settings',
  labelKey: 'settings.tutorial.flow.remindersGoals',
  steps: [
    {
      anchorSelector: '[data-tutorial="settings-tab-reminders"]',
      titleKey: 'settings.tutorial.remindersGoals.reminders.title',
      bodyKey: 'settings.tutorial.remindersGoals.reminders.body',
      action: { event: 'click', icon: 'bell' },
      tier: 'avanzado',
    },
    {
      anchorSelector: '[data-tutorial="settings-tab-goals"]',
      titleKey: 'settings.tutorial.remindersGoals.goals.title',
      bodyKey: 'settings.tutorial.remindersGoals.goals.body',
      action: { event: 'click', icon: 'target' },
      tier: 'avanzado',
    },
    {
      anchorSelector: '[data-tutorial="settings-tab-author"]',
      titleKey: 'settings.tutorial.remindersGoals.author.title',
      bodyKey: 'settings.tutorial.remindersGoals.author.body',
      action: { event: 'click', icon: 'pen-nib' },
      tier: 'avanzado',
    },
  ],
};

export function registerSettingsRemindersGoalsTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(SETTINGS_REMINDERS_GOALS_TUTORIAL, {
    autoStartIfUnseen: false,
  });
  inject(DestroyRef).onDestroy(dispose);
}
