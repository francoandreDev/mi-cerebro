import type { Routes } from '@angular/router';

import { entityReadyResolver } from '@core/fs/entity-ready.guard';

export const listsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./containers/lists-shelf.container').then((m) => m.ListsShelfContainer),
  },
  {
    path: ':id',
    loadComponent: () => import('./containers/lists.container').then((m) => m.ListsContainer),
    resolve: { ready: entityReadyResolver },
  },
];
