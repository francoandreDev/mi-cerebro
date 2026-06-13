import type { Routes } from '@angular/router';

export const syncRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./containers/sync.container').then((m) => m.SyncContainer),
  },
];
