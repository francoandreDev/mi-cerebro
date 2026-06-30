import type { Routes } from '@angular/router';

export const homeRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./containers/home.container').then((m) => m.HomeContainer),
  },
];
