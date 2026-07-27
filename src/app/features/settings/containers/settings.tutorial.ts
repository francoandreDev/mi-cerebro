import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: copy dedicado (no reciclado de home-content.ts). El ícono del rail
//      no se practica con `action` — clickearlo mientras ya estás en
//      /settings no navega a ningún lado nuevo, así que no hay señal real
//      de "lo hiciste" distinta de simplemente estar en la página.
export const SETTINGS_TUTORIAL: TutorialDefinition = {
  id: 'settings',
  pageId: 'settings',
  labelKey: 'settings.tutorial.flow.navigation',
  steps: [
    {
      anchorSelector: '[data-tutorial="settings-rail-icon"]',
      titleKey: 'settings.tutorial.open.title',
      bodyKey: 'settings.tutorial.open.body',
    },
    {
      anchorSelector: '[data-tutorial="settings-nav"]',
      titleKey: 'settings.tutorial.nav.title',
      bodyKey: 'settings.tutorial.nav.body',
      action: { event: 'click', icon: 'caret-right' },
    },
    // why: General es la tab activa por default al entrar (readStoredSection()
    //      cae a 'general'), así que su anchor ya existe sin necesitar click
    //      previo — uso inmediato, tier básico (§8.10 roadmap).
    {
      anchorSelector: '[data-tutorial="settings-section-general"]',
      titleKey: 'settings.tutorial.general.title',
      bodyKey: 'settings.tutorial.general.body',
    },
    {
      anchorSelector: '[data-tutorial="settings-apply"]',
      titleKey: 'settings.tutorial.apply.title',
      bodyKey: 'settings.tutorial.apply.body',
      action: { event: 'click', icon: 'check' },
    },
    {
      anchorSelector: '[data-tutorial="settings-nav"]',
      titleKey: 'settings.tutorial.instant.title',
      bodyKey: 'settings.tutorial.instant.body',
    },
  ],
};

export function registerSettingsTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(SETTINGS_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
