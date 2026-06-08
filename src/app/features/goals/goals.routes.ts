import type { Routes } from '@angular/router';

export const goalsRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./containers/goals.container').then((m) => m.GoalsContainer),
  },
  {
    path: ':id',
    loadComponent: () => import('./containers/goals.container').then((m) => m.GoalsContainer),
  },
];
