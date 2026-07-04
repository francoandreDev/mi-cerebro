import type { Routes } from '@angular/router';

export const devRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./containers/dev.container').then((m) => m.DevContainer),
  },
];
