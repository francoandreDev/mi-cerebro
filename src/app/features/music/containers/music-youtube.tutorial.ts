import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: §8.15 (re-scoped 8.85) — flujo chico pero autocontenido y de
//      naturaleza distinta al resto (trae contenido externo en vez de
//      organizar el existente): input de URL + estado de descarga
//      (`album-library.container.html`, `.youtube-download`). Manual, no
//      `autoStartIfUnseen`. Sin `skipIfMissing`: el bloque siempre está en
//      el DOM y habilitado — en Tauri/Capacitor descarga directo (ver
//      `YoutubeDownloadService.isAvailable`), en navegador el mismo botón
//      abre el generador de comandos (`YoutubeCommandModalComponent`) —
//      nunca condicionalmente montado, a diferencia de otros anchors de
//      esta página.
export const MUSIC_YOUTUBE_TUTORIAL: TutorialDefinition = {
  id: 'music-youtube',
  pageId: 'music',
  labelKey: 'music.tutorial.flow.youtube',
  steps: [
    {
      anchorSelector: '[data-tutorial="music-youtube-input"]',
      titleKey: 'music.tutorial.youtubeUrl.title',
      bodyKey: 'music.tutorial.youtubeUrl.body',
    },
    {
      anchorSelector: '[data-tutorial="music-youtube-download"]',
      titleKey: 'music.tutorial.youtubeDownload.title',
      bodyKey: 'music.tutorial.youtubeDownload.body',
      action: { event: 'click', icon: 'download-simple' },
    },
  ],
};

export function registerMusicYoutubeTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(MUSIC_YOUTUBE_TUTORIAL, { autoStartIfUnseen: false });
  inject(DestroyRef).onDestroy(dispose);
}
