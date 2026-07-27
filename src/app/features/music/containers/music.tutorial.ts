import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: copy dedicado (no reciclado de home-content.ts). El mini-player
//      global (`[data-tutorial="mini-player"]`, layout/) solo renderiza
//      con un track cargado — no "siempre presente" (regla Fase 3) — así
//      que ese step queda sin `action` y se degrada sin spotlight si no
//      hay nada sonando todavía.
export const MUSIC_TUTORIAL: TutorialDefinition = {
  id: 'music',
  pageId: 'music',
  steps: [
    {
      anchorSelector: '[data-tutorial="music-upload"]',
      titleKey: 'music.tutorial.upload.title',
      bodyKey: 'music.tutorial.upload.body',
      action: { event: 'click', icon: 'upload-simple' },
    },
    {
      anchorSelector: '[data-tutorial="music-library"]',
      titleKey: 'music.tutorial.album.title',
      bodyKey: 'music.tutorial.album.body',
      action: { event: 'click', icon: 'music-notes' },
    },
    {
      anchorSelector: '[data-tutorial="music-surface"]',
      titleKey: 'music.tutorial.play.title',
      bodyKey: 'music.tutorial.play.body',
      action: { event: 'keydown', key: ' ', icon: 'play' },
    },
    {
      anchorSelector: '[data-tutorial="music-library"]',
      titleKey: 'music.tutorial.search.title',
      bodyKey: 'music.tutorial.search.body',
      action: { event: 'keydown', key: '/', icon: 'magnifying-glass' },
    },
    {
      anchorSelector: '[data-tutorial="mini-player"]',
      titleKey: 'music.tutorial.miniplayer.title',
      bodyKey: 'music.tutorial.miniplayer.body',
      skipIfMissing: true,
    },
  ],
};

export function registerMusicTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(MUSIC_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
