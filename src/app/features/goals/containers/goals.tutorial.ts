import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: los primeros 3 pasos son el copy canónico de home.entity.goals.step.*
//      (cómo crear una meta desde el hero-create) — sin esto el tutorial
//      pasaba directo a gestos avanzados sin explicar el flujo básico.
//      goals.editor.starOpenHint ya resume los gestos en una línea dentro
//      del editor de una meta puntual (/goals/:id), pero el wall (/goals)
//      —donde primero se topan— no repite ni ese resumen. Los pasos 4-6
//      cubren la secuencia completa (marcar, abrir el detalle, mover), todos
//      gestos reales de la wall — no del editor de una meta puntual. Fix
//      2026-07-25 (roadmap §8.2): el paso "select" original describía
//      shift+click multi-selección + menú click-derecho, un gesto que solo
//      existe en goal-constellation-editor.component.ts (/goals/:id) — en
//      la wall, shift+click navega directo a esa ruta (ver
//      goals-wall.container.ts onStarTap) y no hay contextmenu handler.
//      "move" sí describe un gesto real de la wall (confirmado en
//      goals-wall.container.ts: dragCenter/wallCenter mueven la
//      constelación completa de una meta, no una sola estrella), así que
//      solo se corrigió "select" — no hacía falta mover nada a otra ruta.
export const GOALS_TUTORIAL: TutorialDefinition = {
  id: 'goals',
  pageId: 'goals',
  labelKey: 'goals.tutorial.flow.essentials',
  steps: [
    {
      anchorSelector: '[data-tutorial="goals-create"]',
      titleKey: 'tree.type.goals',
      bodyKey: 'home.entity.goals.step.1',
      // why: "escribís la meta... se imprime como poster" — practica el
      // submit real del hero create en vez de solo leer sobre él.
      action: { event: 'submit', icon: 'plus' },
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
    // why: §8.87 item 1 — el primer click sobre cualquier estrella de una
    //      meta abre el peek, gesto real que ningún step anterior cubría
    //      (mark/openDetail sólo hablaban del 2do click y de shift+click).
    //      skipIfMissing porque requiere al menos una meta con estrella.
    {
      anchorSelector: '[data-tutorial="goals-sky"]',
      titleKey: 'goals.tutorial.openPeek.title',
      bodyKey: 'goals.tutorial.openPeek.body',
      placement: 'bottom',
      action: { event: 'click', selector: '[data-tutorial="goals-sky"] .star', icon: 'sparkle' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="goal-peek-rename"]',
      titleKey: 'goals.tutorial.peekRename.title',
      bodyKey: 'goals.tutorial.peekRename.body',
      action: { event: 'click', icon: 'pencil-simple' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="goal-peek-completed"]',
      titleKey: 'goals.tutorial.peekCompleted.title',
      bodyKey: 'goals.tutorial.peekCompleted.body',
      action: { event: 'click', icon: 'check' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="goal-peek-deadline"]',
      titleKey: 'goals.tutorial.peekDeadline.title',
      bodyKey: 'goals.tutorial.peekDeadline.body',
      action: { event: 'click', icon: 'calendar-blank' },
      skipIfMissing: true,
      moreDetail: { bodyKey: 'goals.tutorial.peekDeadline.moreDetail' },
    },
    {
      anchorSelector: '[data-tutorial="goal-peek-priority"]',
      titleKey: 'goals.tutorial.peekPriority.title',
      bodyKey: 'goals.tutorial.peekPriority.body',
      action: { event: 'click', selector: '[data-tutorial="goal-peek-priority"] .prio-btn' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="goal-peek-delete"]',
      titleKey: 'goals.tutorial.peekDelete.title',
      bodyKey: 'goals.tutorial.peekDelete.body',
      action: { event: 'click', icon: 'trash' },
      skipIfMissing: true,
      moreDetail: { bodyKey: 'goals.tutorial.peekDelete.moreDetail' },
    },
    {
      anchorSelector: '[data-tutorial="goals-sky"]',
      titleKey: 'goals.tutorial.openDetail.title',
      bodyKey: 'goals.tutorial.openDetail.body',
      placement: 'bottom',
      // why: §8.87 item 1 — este step ya describía el gesto real (shift+click
      //      navega directo al editor completo, distinto de abrir el peek);
      //      lo único que le faltaba era el `action` para practicarlo.
      action: {
        event: 'click',
        selector: '[data-tutorial="goals-sky"] .star',
        shiftKey: true,
        icon: 'arrow-right',
      },
      skipIfMissing: true,
    },
    // why: §8.87 item 1 — búsqueda y tags son "mención de existencia" (§8.85
    //      2b: demasiadas combinaciones válidas para un único gesto a
    //      practicar), sólo "ocultar completadas" es un click concreto.
    {
      anchorSelector: '[data-tutorial="goals-filters"]',
      titleKey: 'goals.tutorial.filters.title',
      bodyKey: 'goals.tutorial.filters.body',
      action: { event: 'click', selector: '[data-tutorial="goals-hide-completed"]', icon: 'eye' },
      moreDetail: { bodyKey: 'goals.tutorial.filters.moreDetail' },
    },
    {
      anchorSelector: '[data-tutorial="goals-sky"]',
      titleKey: 'goals.tutorial.move.title',
      bodyKey: 'goals.tutorial.move.body',
      placement: 'bottom',
    },
    // why: docs/deferred/reminders-goals.md — J/K/Space/E/Del sólo tienen
    //      sentido sobre un orden visible; este toggle es el punto de
    //      entrada a ese orden, así que amerita su propio step avanzado.
    {
      anchorSelector: '[data-tutorial="goals-view-toggle"]',
      titleKey: 'goals.tutorial.viewToggle.title',
      bodyKey: 'goals.tutorial.viewToggle.body',
      action: { event: 'click', icon: 'list-bullets' },
      tier: 'avanzado',
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
