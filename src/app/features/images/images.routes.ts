import type { Routes } from '@angular/router';

import { entityReadyResolver } from '@core/fs/entity-ready.guard';

export const imagesRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./containers/galleries-index.container').then((m) => m.GalleriesIndexContainer),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./containers/galleries.container').then((m) => m.GalleriesContainer),
    resolve: { ready: entityReadyResolver },
  },
];
