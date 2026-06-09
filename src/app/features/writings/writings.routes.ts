import type { Routes } from '@angular/router';

export const writingsRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./containers/writings.container').then((m) => m.WritingsContainer),
  },
  {
    path: ':id',
    loadComponent: () => import('./containers/writings.container').then((m) => m.WritingsContainer),
  },
];
