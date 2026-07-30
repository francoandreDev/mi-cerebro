import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why (8.93): restaurar (commit completo o entidad individual) es la única
//      zona de Historial con 3+ pasos propios y consecuencia real
//      (irreversible) → flujo manual separado, nunca autoStartIfUnseen.
// why (confirmación tipeada sin `action`): el último paso ancla el form
//      donde el usuario tipea el shortOid exacto y confirma — un
//      `action: 'submit'` ahí haría que el motor de tutoriales, al
//      detectar el submit real, avance el step Y dispare una restauración
//      real de git sobre el workspace del usuario solo por seguir la guía.
//      Ningún otro step de la app arriesga una mutación irreversible con
//      un solo submit; se deja sin `action` (paso puramente descriptivo)
//      para que el usuario tenga que decidir y tipear conscientemente,
//      nunca "practicar" el gesto dentro del tutorial.
export const HISTORY_RESTORE_TUTORIAL: TutorialDefinition = {
  id: 'history-restore',
  pageId: 'history',
  labelKey: 'history.tutorial.flow.restore',
  steps: [
    {
      anchorSelector: '[data-tutorial="history-timeline"]',
      titleKey: 'history.tutorial.restore.pick.title',
      bodyKey: 'history.tutorial.restore.pick.body',
      placement: 'right',
      action: { event: 'click', selector: '.timeline .commit', icon: 'clock-counter-clockwise' },
    },
    {
      anchorSelector: '[data-tutorial="history-restore-commit-button"]',
      titleKey: 'history.tutorial.restore.scope.title',
      bodyKey: 'history.tutorial.restore.scope.body',
      placement: 'top',
      // why: el botón no aparece si el commit seleccionado ya es HEAD
      //      (nada que restaurar) — degradar sin bloquear el resto del flujo.
      skipIfMissing: true,
      action: { event: 'click', icon: 'arrow-counter-clockwise' },
      moreDetail: { bodyKey: 'history.tutorial.restore.scope.moreDetail' },
    },
    {
      anchorSelector: '[data-tutorial="history-restore-confirm"]',
      titleKey: 'history.tutorial.restore.confirm.title',
      bodyKey: 'history.tutorial.restore.confirm.body',
      placement: 'top',
      skipIfMissing: true,
    },
  ],
};
