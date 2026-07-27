import { inject } from '@angular/core';

import { TutorialService } from './tutorial.service';
import type { TutorialDefinition } from './tutorial.types';

// why: copy 100% de home.flow.project.*/home.flow.daily.* (home-content.ts)
//      — los dos flujos "hoy" que genuinamente cruzan varias páginas, cada
//      step reusa el mismo data-tutorial ya agregado para el tutorial de
//      esa página (cero anchors nuevos). Ver roadmap-26-tutoriales.md.
export const PROJECT_FLOW_TUTORIAL: TutorialDefinition = {
  id: 'flow-project',
  // why: cross-page flows never appear in a per-page picker (only Home's
  //      "Recorrer este flujo" button starts them) — pageId === id keeps
  //      them out of every real page's tutorialsForPage() group.
  pageId: 'flow-project',
  steps: [
    {
      route: '/goals',
      anchorSelector: '[data-tutorial="goals-create"]',
      titleKey: 'home.flow.project.title',
      bodyKey: 'home.flow.project.step.1',
    },
    {
      route: '/writings',
      anchorSelector: '[data-tutorial="writings-new"]',
      titleKey: 'home.flow.project.title',
      bodyKey: 'home.flow.project.step.2',
    },
    {
      route: '/tasks',
      anchorSelector: '[data-tutorial="tasks-compose"]',
      titleKey: 'home.flow.project.title',
      bodyKey: 'home.flow.project.step.3',
    },
    {
      route: '/calendar',
      anchorSelector: '[data-tutorial="calendar-table"]',
      titleKey: 'home.flow.project.title',
      bodyKey: 'home.flow.project.step.4',
    },
  ],
};

export const DAILY_FLOW_TUTORIAL: TutorialDefinition = {
  id: 'flow-daily',
  pageId: 'flow-daily',
  steps: [
    {
      route: '/calendar',
      anchorSelector: '[data-tutorial="calendar-table"]',
      titleKey: 'home.flow.daily.title',
      bodyKey: 'home.flow.daily.step.1',
    },
    {
      route: '/goals',
      anchorSelector: '[data-tutorial="goals-sky"]',
      titleKey: 'home.flow.daily.title',
      bodyKey: 'home.flow.daily.step.2',
    },
    {
      // why: step copy describe el cantero "floración" (hoy) y cosechar,
      // no crear una tarea nueva — tasks-planters/tasks-basket son los
      // anchors reales que tasks.tutorial.ts ya usa para lo mismo.
      route: '/tasks',
      anchorSelector: '[data-tutorial="tasks-planters"]',
      titleKey: 'home.flow.daily.title',
      bodyKey: 'home.flow.daily.step.3',
    },
    {
      // why: "palomas asomadas... las despachás" describe el palomar, no
      // el form de creación.
      route: '/reminders',
      anchorSelector: '[data-tutorial="reminders-palomar"]',
      titleKey: 'home.flow.daily.title',
      bodyKey: 'home.flow.daily.step.4',
    },
  ],
};

// why: registrado una sola vez, siempre vivo (AppShellContainer nunca se
//      destruye) — a diferencia de los tutoriales de página, un flujo no
//      depende de qué ruta esté activa. autoStartIfUnseen: false porque un
//      flujo cross-página nunca debe dispararse solo, siempre lo arranca
//      el usuario desde el botón "Recorrer este flujo" en la home.
export function registerHomeFlowTutorials(): void {
  const tutorials = inject(TutorialService);
  tutorials.register(PROJECT_FLOW_TUTORIAL, { autoStartIfUnseen: false });
  tutorials.register(DAILY_FLOW_TUTORIAL, { autoStartIfUnseen: false });
}
