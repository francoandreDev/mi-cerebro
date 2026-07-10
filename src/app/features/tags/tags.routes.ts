import type { Routes } from '@angular/router';

import { entityReadyResolver } from '@core/fs/entity-ready.guard';

export const tagsRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./containers/tags.container').then((m) => m.TagsContainer),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./containers/tag-detail.container').then((m) => m.TagDetailContainer),
    resolve: { ready: entityReadyResolver },
  },
];
