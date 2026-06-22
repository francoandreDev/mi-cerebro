import type { Routes } from '@angular/router';

export const goalsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./containers/goals-wall.container').then((m) => m.GoalsWallContainer),
  },
  {
    path: ':id',
    loadComponent: () => import('./containers/goals.container').then((m) => m.GoalsContainer),
  },
];
