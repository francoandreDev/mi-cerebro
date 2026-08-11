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

// why: "Ver todo lo de un tema" promovido de HOME_WORKFLOWS_FUTURE a
//      HOME_WORKFLOWS_TODAY — la vista ya existe (palette `tag:` + `/tags/:id`
//      con preview nativo por kind), la tarjeta "próximamente" mentía. Sin
//      anchor propio para "abrir el palomar" — reusa el mismo botón que
//      command-palette.tutorial.ts (cero anchors nuevos). El step 2 no lleva
//      `action` porque escribir `tag:<nombre>` es un evento `input` de texto
//      libre, no soportado por TutorialStepAction (ver reglas.md §4.6.15b).
export const TAGVIEW_FLOW_TUTORIAL: TutorialDefinition = {
  id: 'flow-tagview',
  pageId: 'flow-tagview',
  steps: [
    {
      anchorSelector: '[data-tutorial="command-palette-open"]',
      titleKey: 'home.flow.tagview.title',
      bodyKey: 'home.flow.tagview.step.1',
      action: { event: 'click', icon: 'magnifying-glass' },
    },
    {
      anchorSelector: '[data-tutorial="command-palette-input"]',
      titleKey: 'home.flow.tagview.title',
      bodyKey: 'home.flow.tagview.step.2',
    },
    {
      route: '/tags',
      anchorSelector: '[data-tutorial="tags-header"]',
      titleKey: 'home.flow.tagview.title',
      bodyKey: 'home.flow.tagview.step.3',
    },
  ],
};

// why: "Estudiar profundizando un tema" promovido de HOME_WORKFLOWS_FUTURE a
//      HOME_WORKFLOWS_TODAY — la única pieza que faltaba (quick-capture
//      global, Alt+Shift+N) ya está cableada en core/intents/quick-capture.service.ts,
//      con scope 'global' (dispara aun con foco en el editor del reader) y
//      resuelve el tag de contexto vía parseDetailUrl, que sí mapea
//      `/books/:id` → kind 'book' (kind-routes.ts). Los steps 2 y 3 no
//      llevan `route` porque el reader vive en `/books/:id/leer` (id
//      dinámico, sin anchor genérico posible) — se quedan en la ruta donde
//      el usuario ya esté y usan `skipIfMissing` como el resto de los
//      steps de reader en books.tutorial.ts.
export const STUDY_FLOW_TUTORIAL: TutorialDefinition = {
  id: 'flow-study',
  pageId: 'flow-study',
  steps: [
    {
      route: '/books',
      anchorSelector: '[data-tutorial="books-shelf"]',
      titleKey: 'home.flow.study.title',
      bodyKey: 'home.flow.study.step.1',
      action: { event: 'click', selector: '[data-tutorial="books-new"]', icon: 'plus' },
    },
    {
      anchorSelector: '[data-tutorial="books-reader-pane"]',
      titleKey: 'home.flow.study.title',
      bodyKey: 'home.flow.study.step.2',
      action: { event: 'keydown', key: 'n', altKey: true, shiftKey: true, icon: 'sparkle' },
      skipIfMissing: true,
    },
    {
      anchorSelector: '[data-tutorial="books-reader-pane"]',
      titleKey: 'home.flow.study.title',
      bodyKey: 'home.flow.study.step.3',
      skipIfMissing: true,
    },
    {
      route: '/tags',
      anchorSelector: '[data-tutorial="tags-header"]',
      titleKey: 'home.flow.study.title',
      bodyKey: 'home.flow.study.step.4',
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
  tutorials.register(TAGVIEW_FLOW_TUTORIAL, { autoStartIfUnseen: false });
  tutorials.register(STUDY_FLOW_TUTORIAL, { autoStartIfUnseen: false });
}
