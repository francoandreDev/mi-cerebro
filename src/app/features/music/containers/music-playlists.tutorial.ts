import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: §8.15 (re-scoped 8.85) — "playlist-editor no tiene step propio" se
//      quedaba corto: es una superficie entera (crear/reproducir/shuffle/
//      eliminar playlist, favorito, reordenar tracks por drag, agregar vía
//      picker con búsqueda). Manual, no `autoStartIfUnseen`. Primer step
//      practica el cambio de tab (Álbumes → Playlists, mismo patrón que
//      Settings §4.6.15b) — el resto de los anchors solo existen dentro de
//      esa tab (`playlists-panel.container.html`) o dentro del editor de
//      una playlist activa (`playlist-editor.container.html`), de ahí
//      `skipIfMissing: true` en todos.
export const MUSIC_PLAYLISTS_TUTORIAL: TutorialDefinition = {
  id: 'music-playlists',
  pageId: 'music',
  labelKey: 'music.tutorial.flow.playlists',
  steps: [
    {
      anchorSelector: '[data-tutorial="music-tab-playlists"]',
      titleKey: 'music.tutorial.tabPlaylists.title',
      bodyKey: 'music.tutorial.tabPlaylists.body',
      action: { event: 'click', icon: 'list-bullets' },
    },
    {
      anchorSelector: '[data-tutorial="music-playlists-create"]',
      titleKey: 'music.tutorial.playlistCreate.title',
      bodyKey: 'music.tutorial.playlistCreate.body',
      action: { event: 'click', icon: 'plus' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="music-playlists-row"]',
      titleKey: 'music.tutorial.playlistOpen.title',
      bodyKey: 'music.tutorial.playlistOpen.body',
      action: { event: 'click' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="music-playlist-favorite"]',
      titleKey: 'music.tutorial.playlistFavorite.title',
      bodyKey: 'music.tutorial.playlistFavorite.body',
      action: { event: 'click', icon: 'star' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="music-playlist-play"]',
      titleKey: 'music.tutorial.playlistPlay.title',
      bodyKey: 'music.tutorial.playlistPlay.body',
      action: { event: 'click', icon: 'play' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="music-playlist-shuffle"]',
      titleKey: 'music.tutorial.playlistShuffle.title',
      bodyKey: 'music.tutorial.playlistShuffle.body',
      action: { event: 'click', icon: 'shuffle' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="music-playlist-track-row"]',
      titleKey: 'music.tutorial.playlistReorder.title',
      bodyKey: 'music.tutorial.playlistReorder.body',
      action: { event: 'dragstart' },
      skipIfMissing: true,
    },
    // why: letras (toggle + búsqueda externa, `now-playing.container.html`)
    //      son 3 steps posibles pero chicas/secundarias — quedan como
    //      `moreDetail` acá en vez de flujo propio (§8.15 punto 5). Atajos
    //      n/p ya están en el diálogo global de atajos, solo se mencionan.
    {
      anchorSelector: '[data-tutorial="music-playlist-add-toggle"]',
      titleKey: 'music.tutorial.playlistAddTracks.title',
      bodyKey: 'music.tutorial.playlistAddTracks.body',
      action: { event: 'click', icon: 'plus' },
      skipIfMissing: true,
      moreDetail: { bodyKey: 'music.tutorial.playlistAddTracks.moreDetail' },
    },
    {
      anchorSelector: '[data-tutorial="music-playlist-delete"]',
      titleKey: 'music.tutorial.playlistDelete.title',
      bodyKey: 'music.tutorial.playlistDelete.body',
      action: { event: 'click', icon: 'trash' },
      skipIfMissing: true,
    },
  ],
};

export function registerMusicPlaylistsTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(MUSIC_PLAYLISTS_TUTORIAL, { autoStartIfUnseen: false });
  inject(DestroyRef).onDestroy(dispose);
}
