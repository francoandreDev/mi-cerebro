import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: no vive en ninguna ruta propia — el buscador se abre desde
//      cualquier página vía el botón del sidebar o Ctrl+K, así que
//      `pageId === id` lo mantiene fuera del picker de cualquier página
//      real (mismo patrón que flow-project/flow-daily en
//      home-flows.tutorial.ts) y se registra una sola vez, siempre vivo,
//      desde este mismo container (montado sin condición en AppShellContainer
//      salvo por workspace.isReady()).
export const COMMAND_PALETTE_TUTORIAL: TutorialDefinition = {
  id: 'command-palette',
  pageId: 'command-palette',
  steps: [
    // why: placement 'right' — el anchor es el último ítem del rail,
    //      pegado a la esquina inferior izquierda; con el placement
    //      default ('bottom') la tarjeta no tiene espacio hacia abajo y
    //      el cardBox() clamped queda tapando el propio botón, bloqueando
    //      el click real que el step le pide practicar al usuario.
    {
      anchorSelector: '[data-tutorial="command-palette-open"]',
      titleKey: 'palette.tutorial.open.title',
      bodyKey: 'palette.tutorial.open.body',
      placement: 'right',
      action: { event: 'click', icon: 'magnifying-glass' },
      moreDetail: { bodyKey: 'palette.tutorial.open.moreDetail' },
    },
    // why: sin action — no hay evento DOM de "input" en TutorialStepAction,
    //      y forzar al usuario a escribir algo específico sería frágil
    //      (cualquier texto sirve). El moreDetail cubre `tag:` y "olvidar".
    {
      anchorSelector: '[data-tutorial="command-palette-input"]',
      titleKey: 'palette.tutorial.search.title',
      bodyKey: 'palette.tutorial.search.body',
      skipIfMissing: true,
      moreDetail: { bodyKey: 'palette.tutorial.search.moreDetail' },
    },
    {
      anchorSelector: '[data-tutorial="command-palette-results"]',
      titleKey: 'palette.tutorial.navigate.title',
      bodyKey: 'palette.tutorial.navigate.body',
      action: { event: 'keydown', key: 'arrowdown', icon: 'arrow-down' },
      skipIfMissing: true,
      moreDetail: { bodyKey: 'palette.tutorial.navigate.moreDetail' },
    },
    // why: último step a propósito — Enter activa el resultado, navega y
    //      cierra la paleta (CommandPaletteContainer#activate), así que
    //      cualquier step posterior perdería su anchor. "Esc cierra sin
    //      elegir" queda mencionado en el body en vez de ser un step propio
    //      practicable, por la misma razón (ambos gestos cierran la paleta,
    //      solo uno puede ser el que termina el flujo).
    {
      anchorSelector: '[data-tutorial="command-palette-results"]',
      titleKey: 'palette.tutorial.pick.title',
      bodyKey: 'palette.tutorial.pick.body',
      action: { event: 'keydown', key: 'enter', icon: 'check' },
      skipIfMissing: true,
    },
  ],
};

export function registerCommandPaletteTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(COMMAND_PALETTE_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
