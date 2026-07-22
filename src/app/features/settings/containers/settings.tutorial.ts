import { DestroyRef, inject } from '@angular/core';

import { buildEntityTutorial } from '@core/tutorials/entity-tutorial.builder';
import { TutorialService } from '@core/tutorials/tutorial.service';

export const SETTINGS_TUTORIAL = buildEntityTutorial('settings', '[data-tutorial="settings-nav"]', [
  // step 3: "ajustás y los cambios se aplican al instante" — el botón
  // real de aplicar en la sección General, no de nuevo las tabs.
  { step: 3, anchorSelector: '[data-tutorial="settings-apply"]' },
]);

export function registerSettingsTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(SETTINGS_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
