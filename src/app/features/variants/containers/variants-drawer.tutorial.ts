import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: §8.11 (re-scoped por 8.85) — el drawer de detalle de una variante
//      (variant-drawer.component.html) tiene 4+ gestos independientes que
//      el flujo esencial nunca practicó (rename inline, color, borrar con
//      confirmación, navegar por pills de historial). Registrado desde
//      VariantsContainer (el único lugar donde el drawer existe) igual que
//      `variants`, así que ambos comparten `pageId` y el picker "Guía de la
//      página" los agrupa en /variants.
export const VARIANTS_DRAWER_TUTORIAL: TutorialDefinition = {
  id: 'variants-drawer',
  pageId: 'variants',
  labelKey: 'variants.tutorial.flow.drawer',
  steps: [
    {
      anchorSelector: '[data-tutorial="variant-rename-start"]',
      titleKey: 'variants.tutorial.drawer.renameStart.title',
      bodyKey: 'variants.tutorial.drawer.renameStart.body',
      action: { event: 'click', icon: 'pencil-simple' },
    },
    {
      anchorSelector: '[data-tutorial="variant-rename-input"]',
      titleKey: 'variants.tutorial.drawer.renameConfirm.title',
      bodyKey: 'variants.tutorial.drawer.renameConfirm.body',
      action: { event: 'keydown', key: 'Enter', icon: 'check' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="variant-color-picker"]',
      titleKey: 'variants.tutorial.drawer.color.title',
      bodyKey: 'variants.tutorial.drawer.color.body',
      action: { event: 'click', icon: 'palette' },
    },
    // why: eliminar es el único gesto realmente destructivo del drawer —
    //      abre un diálogo de confirmación con warning de cambios sin
    //      mergear (ver `variants.delete.unmerged.warning`). El diálogo en
    //      sí es `mc-confirm-dialog` (shared, genérico) sin anchor propio
    //      por página, así que el step apunta al botón que lo dispara.
    {
      anchorSelector: '[data-tutorial="variant-delete-start"]',
      titleKey: 'variants.tutorial.drawer.delete.title',
      bodyKey: 'variants.tutorial.drawer.delete.body',
      action: { event: 'click', icon: 'trash' },
      tier: 'avanzado',
    },
    // why: ahead-behind se excluye — clickear ese pill dispara `merge.emit()`
    //      (lleva a /variants/merge), no navegación de historial; el
    //      texto del roadmap lo agrupaba con parent/milestone/HEAD por
    //      error. Ver desvío documentado en el roadmap.
    {
      anchorSelector: '[data-tutorial="variant-history-head"]',
      titleKey: 'variants.tutorial.drawer.history.title',
      bodyKey: 'variants.tutorial.drawer.history.body',
      action: { event: 'click', icon: 'clock-counter-clockwise' },
      skipIfMissing: true,
      moreDetail: { bodyKey: 'variants.tutorial.drawer.history.moreDetail' },
    },
  ],
};

export function registerVariantsDrawerTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(VARIANTS_DRAWER_TUTORIAL, { autoStartIfUnseen: false });
  inject(DestroyRef).onDestroy(dispose);
}
