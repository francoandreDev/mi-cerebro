import type { Routes } from '@angular/router';

export const listsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./containers/lists-shelf.container').then((m) => m.ListsShelfContainer),
  },
  {
    path: ':id',
    loadComponent: () => import('./containers/lists.container').then((m) => m.ListsContainer),
  },
];
