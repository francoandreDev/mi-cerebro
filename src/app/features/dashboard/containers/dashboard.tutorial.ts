import { DestroyRef, inject } from '@angular/core';

import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TutorialDefinition } from '@core/tutorials/tutorial.types';

// why: Panel no tiene card propia en home-content.ts (no está en el
//      "Qué hay" de la home) — copy nuevo, verificado contra
//      dashboard.container.html: 5 widgets (tareas de hoy, objetivos
//      activos, recordatorios próximos, notas/escritos recientes,
//      "Redescubrí esto") que solo agregan lectura, sin acción propia
//      salvo click-through y el shuffle/dismiss del último.
export const DASHBOARD_TUTORIAL: TutorialDefinition = {
  id: 'dashboard',
  steps: [
    {
      anchorSelector: '[data-tutorial="dashboard-grid"]',
      titleKey: 'dashboard.title',
      bodyKey: 'dashboard.tutorial.widgets.body',
    },
    {
      anchorSelector: '[data-tutorial="dashboard-resurface"]',
      titleKey: 'dashboard.title',
      bodyKey: 'dashboard.tutorial.resurface.body',
    },
  ],
};

export function registerDashboardTutorial(): void {
  const tutorials = inject(TutorialService);
  const dispose = tutorials.register(DASHBOARD_TUTORIAL, { autoStartIfUnseen: true });
  inject(DestroyRef).onDestroy(dispose);
}
