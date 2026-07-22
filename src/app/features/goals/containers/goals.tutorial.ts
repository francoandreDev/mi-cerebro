import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: los primeros 3 pasos son el copy canónico de home.entity.goals.step.*
//      (cómo crear una meta desde el hero-create) — sin esto el tutorial
//      pasaba directo a gestos avanzados sin explicar el flujo básico.
//      goals.editor.starOpenHint ya resume los gestos en una línea dentro
//      del editor de una meta puntual (/goals/:id), pero el wall (/goals)
//      —donde primero se topan— no repite ni ese resumen. Los pasos 4-6
//      cubren la secuencia completa (marcar, seleccionar, menú, mover),
//      no solo el significado de un símbolo.
export const GOALS_TUTORIAL: TutorialDefinition = {
  id: 'goals',
  steps: [
    {
      anchorSelector: '[data-tutorial="goals-create"]',
      titleKey: 'tree.type.goals',
      bodyKey: 'home.entity.goals.step.1',
    },
    {
      anchorSelector: '[data-tutorial="goals-create"]',
      titleKey: 'tree.type.goals',
      bodyKey: 'home.entity.goals.step.2',
    },
    {
      anchorSelector: '[data-tutorial="goals-create"]',
      titleKey: 'tree.type.goals',
      bodyKey: 'home.entity.goals.step.3',
    },
    {
      anchorSelector: '[data-tutorial="goals-sky"]',
      titleKey: 'goals.tutorial.mark.title',
      bodyKey: 'goals.tutorial.mark.body',
      placement: 'bottom',
    },
    {
      anchorSelector: '[data-tutorial="goals-sky"]',
      titleKey: 'goals.tutorial.select.title',
      bodyKey: 'goals.tutorial.select.body',
      placement: 'bottom',
    },
    {
      anchorSelector: '[data-tutorial="goals-sky"]',
      titleKey: 'goals.tutorial.move.title',
      bodyKey: 'goals.tutorial.move.body',
      placement: 'bottom',
    },
  ],
};

// why: mueve el boilerplate de inject/register/dispose fuera del container
//      (ya al límite de líneas, ver reglas.md §4.4) — mismo motivo por el
//      que music.shortcuts.ts vive aparte de MusicContainer.
export function registerGoalsTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(GOALS_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
