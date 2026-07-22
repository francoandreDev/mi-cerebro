import { inject } from '@angular/core';

import { TutorialService } from './tutorial.service';
import type { TutorialDefinition } from './tutorial.types';

// why: copy 100% de home.flow.project.*/home.flow.daily.* (home-content.ts)
//      — los dos flujos "hoy" que genuinamente cruzan varias páginas, cada
//      step reusa el mismo data-tutorial ya agregado para el tutorial de
//      esa página (cero anchors nuevos). Ver roadmap-26-tutoriales.md.
export const PROJECT_FLOW_TUTORIAL: TutorialDefinition = {
  id: 'flow-project',
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
      route: '/tasks',
      anchorSelector: '[data-tutorial="tasks-compose"]',
      titleKey: 'home.flow.daily.title',
      bodyKey: 'home.flow.daily.step.3',
    },
    {
      route: '/reminders',
      anchorSelector: '[data-tutorial="reminders-quick-add"]',
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
