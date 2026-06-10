import type { Routes } from '@angular/router';

export const historyRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./containers/history.container').then((m) => m.HistoryContainer),
  },
];
