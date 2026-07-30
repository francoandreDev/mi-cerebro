import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: copy dedicado (no reciclado de home-content.ts). El mini-player
//      global (`[data-tutorial="mini-player"]`, layout/) solo renderiza
//      con un track cargado — no "siempre presente" (regla Fase 3) — así
//      que ese step lleva `skipIfMissing: true` (bug 8.3) y se saltea sin
//      dejar la tarjeta flotando en (0,0) si no hay nada sonando todavía.
//      Segundo pase de 8.85/8.15: sumó el seek real sobre la waveform de
//      "Reproduciendo ahora" (`now-playing.container.html`, solo existe con
//      `currentTrack()`, mismo motivo de `skipIfMissing`) y un `moreDetail`
//      sobre drag&drop de tracks a la pestaña Playlists + cola de
//      reproducción (jump-to/clear) — gestos reales pero secundarios al
//      flujo esencial, no ameritan step propio.
export const MUSIC_TUTORIAL: TutorialDefinition = {
  id: 'music',
  pageId: 'music',
  labelKey: 'music.tutorial.flow.essentials',
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
      moreDetail: { bodyKey: 'music.tutorial.album.moreDetail' },
    },
    {
      anchorSelector: '[data-tutorial="music-surface"]',
      titleKey: 'music.tutorial.play.title',
      bodyKey: 'music.tutorial.play.body',
      action: { event: 'keydown', key: ' ', icon: 'play' },
    },
    // why: seek real arrastrando/clickeando la waveform de "Reproduciendo
    //      ahora" — gesto propio, distinto de play/pause con espacio.
    {
      anchorSelector: '[data-tutorial="music-waveform"]',
      titleKey: 'music.tutorial.seek.title',
      bodyKey: 'music.tutorial.seek.body',
      action: { event: 'click', icon: 'chart-line' },
      skipIfMissing: true,
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
    // why: §8.15 (re-scoped 8.85) — selección múltiple + bulk actions
    // comparten anchor/contexto con el listado esencial de álbum (es un
    // modo del mismo listado), así que se pliegan acá como `tier:
    // 'avanzado'` en vez de un flujo aparte. Todos `skipIfMissing` porque
    // requieren al menos un track en la biblioteca.
    {
      anchorSelector: '[data-tutorial="music-bulk-select"]',
      titleKey: 'music.tutorial.bulkSelect.title',
      bodyKey: 'music.tutorial.bulkSelect.body',
      action: { event: 'click', icon: 'check' },
      tier: 'avanzado',
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="music-bulk-delete"]',
      titleKey: 'music.tutorial.bulkDelete.title',
      bodyKey: 'music.tutorial.bulkDelete.body',
      action: { event: 'click', icon: 'trash' },
      tier: 'avanzado',
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="music-bulk-add-select"]',
      titleKey: 'music.tutorial.bulkAddToPlaylist.title',
      bodyKey: 'music.tutorial.bulkAddToPlaylist.body',
      tier: 'avanzado',
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="music-bulk-clear"]',
      titleKey: 'music.tutorial.bulkClear.title',
      bodyKey: 'music.tutorial.bulkClear.body',
      action: { event: 'click', icon: 'x' },
      tier: 'avanzado',
      skipIfMissing: true,
    },
  ],
};

export function registerMusicTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(MUSIC_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
