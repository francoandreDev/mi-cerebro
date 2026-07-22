import { DestroyRef, inject } from '@angular/core';

import { buildEntityTutorial } from '@core/tutorials/entity-tutorial.builder';
import { TutorialService } from '@core/tutorials/tutorial.service';

export const MUSIC_TUTORIAL = buildEntityTutorial('music', '[data-tutorial="music-upload"]', [
  // step 2: "click en un álbum carga sus tracks en la cola" — la
  // biblioteca de álbumes, no el botón de subir.
  { step: 2, anchorSelector: '[data-tutorial="music-library"]' },
  // step 3: "le das play: la superficie empieza a vibrar..."
  { step: 3, anchorSelector: '[data-tutorial="music-surface"]' },
]);

export function registerMusicTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(MUSIC_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
