import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: Historial combina una metáfora sin leyenda por defecto (3 modos de
//      zoom con nombres propios) con la única función de la app que hasta
//      hace poco no explicaba en ningún lado qué separa "Cordillera" de
//      "Estratos" de "Cordel" — la leyenda estática (versioning.history.zoom.legend.*)
//      ya cubre el significado de cada nivel; este tutorial cubre lo que la
//      leyenda no puede: CÓMO se navega entre ellos.
export const HISTORY_TUTORIAL: TutorialDefinition = {
  id: 'history',
  pageId: 'history',
  steps: [
    {
      anchorSelector: '[data-tutorial="history-zoom"]',
      titleKey: 'history.tutorial.zoom.title',
      bodyKey: 'history.tutorial.zoom.body',
      placement: 'bottom',
    },
    {
      anchorSelector: '[data-tutorial="history-timeline"]',
      titleKey: 'history.tutorial.timeline.title',
      bodyKey: 'history.tutorial.timeline.body',
      placement: 'right',
    },
    {
      anchorSelector: '[data-tutorial="history-milestones-filter"]',
      titleKey: 'history.tutorial.milestones.title',
      bodyKey: 'history.tutorial.milestones.body',
      placement: 'bottom',
    },
  ],
};
