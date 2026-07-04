import type { Routes } from '@angular/router';

export const tagsRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./containers/tags.container').then((m) => m.TagsContainer),
  },
];
