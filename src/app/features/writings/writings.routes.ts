import type { Routes } from '@angular/router';

export const writingsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./containers/writings-shelf.container').then((m) => m.WritingsShelfContainer),
  },
  {
    path: ':id',
    loadComponent: () => import('./containers/writings.container').then((m) => m.WritingsContainer),
  },
];
