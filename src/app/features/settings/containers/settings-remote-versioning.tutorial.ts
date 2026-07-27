import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: 3 de las 9 tabs de Settings agrupadas por tema — backup/historial
//      (§8.10 roadmap-26-tutoriales.md). Cada step ancla en el botón de la
//      tab misma (`settings-tab-<id>`, siempre presente en el nav) en vez de
//      en contenido del panel, porque ese contenido solo existe en el DOM
//      una vez la tab está activa — anclar ahí forzaría `skipIfMissing` y el
//      motor saltearía el step entero antes de mostrar la acción de click
//      que lo activaría (ver `tutorial-overlay.component.ts#measure`). El
//      click sobre el botón de la tab ya es la práctica real de cambiarla;
//      el contenido en sí se explica en `bodyKey`/`moreDetail`.
export const SETTINGS_REMOTE_VERSIONING_TUTORIAL: TutorialDefinition = {
  id: 'settings-remote-versioning',
  pageId: 'settings',
  labelKey: 'settings.tutorial.flow.remoteVersioning',
  steps: [
    {
      anchorSelector: '[data-tutorial="settings-tab-remote"]',
      titleKey: 'settings.tutorial.remoteVersioning.remote.title',
      bodyKey: 'settings.tutorial.remoteVersioning.remote.body',
      action: { event: 'click', icon: 'git-branch' },
      tier: 'avanzado',
      moreDetail: { bodyKey: 'settings.tutorial.remoteVersioning.remote.moreDetail' },
    },
    {
      anchorSelector: '[data-tutorial="settings-tab-versioning"]',
      titleKey: 'settings.tutorial.remoteVersioning.versioning.title',
      bodyKey: 'settings.tutorial.remoteVersioning.versioning.body',
      action: { event: 'click', icon: 'clock-counter-clockwise' },
      tier: 'avanzado',
      moreDetail: { bodyKey: 'settings.tutorial.remoteVersioning.versioning.moreDetail' },
    },
    {
      anchorSelector: '[data-tutorial="settings-tab-variants"]',
      titleKey: 'settings.tutorial.remoteVersioning.variants.title',
      bodyKey: 'settings.tutorial.remoteVersioning.variants.body',
      action: { event: 'click', icon: 'copy' },
      tier: 'avanzado',
    },
  ],
};

export function registerSettingsRemoteVersioningTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(SETTINGS_REMOTE_VERSIONING_TUTORIAL, {
    autoStartIfUnseen: false,
  });
  inject(DestroyRef).onDestroy(dispose);
}
