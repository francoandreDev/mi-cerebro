import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: Historial combina una metáfora sin leyenda por defecto (3 modos de
//      zoom con nombres propios) con la única función de la app que hasta
//      hace poco no explicaba en ningún lado qué separa "Cordillera" de
//      "Estratos" de "Cordel" — la leyenda estática (versioning.history.zoom.legend.*)
//      ya cubre el significado de cada nivel; este tutorial cubre lo que la
//      leyenda no puede: CÓMO se navega entre ellos.
// why (8.93): '+' y '-'/Esc son la misma familia de gesto (cambiar de nivel
//      de zoom, uno de ida y otro de vuelta — mismo criterio que "PageUp/
//      PageDown pasa página" en reglas.md §4.6.15b) → un solo step con
//      action en '+', el resto se menciona en el body. '[' / ']' navegan
//      milestone a milestone: gesto distinto (no cambia de nivel), así que
//      es su propio step nuevo, tier avanzado porque solo tiene efecto
//      visible si ya hay hitos marcados.
export const HISTORY_TUTORIAL: TutorialDefinition = {
  id: 'history',
  pageId: 'history',
  labelKey: 'history.tutorial.flow.essentials',
  steps: [
    {
      anchorSelector: '[data-tutorial="history-zoom"]',
      titleKey: 'history.tutorial.zoom.title',
      bodyKey: 'history.tutorial.zoom.body',
      placement: 'bottom',
      action: { event: 'keydown', key: '+', icon: 'plus' },
    },
    {
      anchorSelector: '[data-tutorial="history-timeline"]',
      titleKey: 'history.tutorial.timeline.title',
      bodyKey: 'history.tutorial.timeline.body',
      placement: 'right',
      // why (8.93): el resto de la sintaxis/controles del timeline
      //      (facet:/since:/sha:, chips de faceta, compactar diff, auto-
      //      agrupar commits de ruido, banner "compactar ahora") son
      //      demasiado situacionales para practicarse uno por uno —
      //      mención de existencia sobre este mismo anchor. "Agrupar por
      //      tipo" quedó afuera: se descubrió muerto en el template (ver
      //      docs/deferred/versionado.md), no hay UI real que mencionar.
      moreDetail: { bodyKey: 'history.tutorial.timeline.moreDetail' },
    },
    {
      anchorSelector: '[data-tutorial="history-timeline"]',
      titleKey: 'history.tutorial.nav.title',
      bodyKey: 'history.tutorial.nav.body',
      placement: 'right',
      tier: 'avanzado',
      action: { event: 'keydown', key: ']', icon: 'arrow-right' },
    },
    {
      anchorSelector: '[data-tutorial="history-milestones-filter"]',
      titleKey: 'history.tutorial.milestones.title',
      bodyKey: 'history.tutorial.milestones.body',
      placement: 'bottom',
    },
    {
      anchorSelector: '[data-tutorial="history-milestone-mark"]',
      titleKey: 'history.tutorial.milestoneMark.title',
      bodyKey: 'history.tutorial.milestoneMark.body',
      placement: 'top',
      tier: 'avanzado',
      // why (8.93): solo aparece cuando el commit seleccionado todavía no
      //      tiene hito — si el usuario abre el tutorial con un commit ya
      //      marcado, el botón no está en el DOM.
      skipIfMissing: true,
      action: { event: 'click', icon: 'flag' },
    },
  ],
};
