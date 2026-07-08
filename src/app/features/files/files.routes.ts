import type { Routes } from '@angular/router';

import { entityReadyResolver } from '@core/fs/entity-ready.guard';

export const filesRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./containers/files.container').then((m) => m.FilesContainer),
  },
  {
    path: ':id',
    loadComponent: () => import('./containers/files.container').then((m) => m.FilesContainer),
    resolve: { ready: entityReadyResolver },
  },
];
