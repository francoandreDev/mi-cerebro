import type { Routes } from '@angular/router';

import { entityReadyResolver } from '@core/fs/entity-ready.guard';

export const tasksRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./containers/tasks-garden.container').then((m) => m.TasksGardenContainer),
  },
  {
    path: 'patio',
    loadComponent: () =>
      import('./containers/tasks-patio.container').then((m) => m.TasksPatioContainer),
  },
  {
    path: ':id',
    loadComponent: () => import('./containers/tasks.container').then((m) => m.TasksContainer),
    resolve: { ready: entityReadyResolver },
  },
];
