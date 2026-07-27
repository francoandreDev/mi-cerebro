import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: las 2 tabs restantes de Settings (§8.10 roadmap-26-tutoriales.md).
//      Tema concentra bastante control (override claro/oscuro, hue/sat/
//      acento, contraste, reset) pero sigue siendo 1 tab → 1 step, con
//      `moreDetail` para la profundidad en vez de partir en más steps —
//      mismo motivo que los otros 2 flujos agrupados para anclar en el
//      botón de la tab en vez del contenido del panel.
export const SETTINGS_THEME_EXPORT_TUTORIAL: TutorialDefinition = {
  id: 'settings-theme-export',
  pageId: 'settings',
  labelKey: 'settings.tutorial.flow.themeExport',
  steps: [
    {
      anchorSelector: '[data-tutorial="settings-tab-theme"]',
      titleKey: 'settings.tutorial.themeExport.theme.title',
      bodyKey: 'settings.tutorial.themeExport.theme.body',
      action: { event: 'click', icon: 'palette' },
      tier: 'avanzado',
      moreDetail: { bodyKey: 'settings.tutorial.themeExport.theme.moreDetail' },
    },
    {
      anchorSelector: '[data-tutorial="settings-tab-export"]',
      titleKey: 'settings.tutorial.themeExport.export.title',
      bodyKey: 'settings.tutorial.themeExport.export.body',
      action: { event: 'click', icon: 'archive' },
      tier: 'avanzado',
    },
  ],
};

export function registerSettingsThemeExportTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(SETTINGS_THEME_EXPORT_TUTORIAL, {
    autoStartIfUnseen: false,
  });
  inject(DestroyRef).onDestroy(dispose);
}
