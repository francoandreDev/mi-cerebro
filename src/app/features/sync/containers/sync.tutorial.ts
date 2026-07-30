import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: todo `.layout` (consola + panel) vive detrás de `@if (isConfigured())`
//      — `skipIfMissing: true` en cada step deja que el motor resuelva las
//      dos situaciones con la misma definición: sin configurar, solo existe
//      el step 0 (el resto se saltea en cascada y el flujo termina ahí);
//      configurado, el step 0 (`.not-configured`) no existe y se saltea
//      hacia el step 1 sin que el usuario note nada raro.
export const SYNC_TUTORIAL: TutorialDefinition = {
  id: 'sync',
  pageId: 'sync',
  steps: [
    {
      anchorSelector: '[data-tutorial="sync-not-configured"]',
      titleKey: 'sync.tutorial.notConfigured.title',
      bodyKey: 'sync.tutorial.notConfigured.body',
      action: { event: 'click', selector: '[data-tutorial="sync-not-configured"] a', icon: 'gear' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="sync-push"]',
      titleKey: 'sync.tutorial.push.title',
      bodyKey: 'sync.tutorial.push.body',
      action: { event: 'click', icon: 'upload-simple' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="sync-fetch"]',
      titleKey: 'sync.tutorial.fetch.title',
      bodyKey: 'sync.tutorial.fetch.body',
      action: { event: 'click', icon: 'download-simple' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="sync-console"]',
      titleKey: 'sync.tutorial.console.title',
      bodyKey: 'sync.tutorial.console.body',
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="sync-autopush-toggle"]',
      titleKey: 'sync.tutorial.autoPush.title',
      bodyKey: 'sync.tutorial.autoPush.body',
      action: { event: 'click', icon: 'arrows-clockwise' },
      tier: 'avanzado',
      skipIfMissing: true,
      moreDetail: { bodyKey: 'sync.tutorial.autoPush.moreDetail' },
    },
    // why: cross-reference nada más — el paso a paso de cómo resolver un
    //      merge vive en variants-merge (8.11), acá solo se enseña el punto
    //      de entrada. skipIfMissing porque la mayoría de los usuarios no
    //      tiene ninguna rama divergente la primera vez que ve esta página.
    {
      anchorSelector: '[data-tutorial="sync-divergent-link"]',
      titleKey: 'sync.tutorial.divergent.title',
      bodyKey: 'sync.tutorial.divergent.body',
      action: { event: 'click', icon: 'git-branch' },
      tier: 'avanzado',
      skipIfMissing: true,
    },
  ],
};

export function registerSyncTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(SYNC_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
