import type { Routes } from '@angular/router';

export const trashRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./containers/trash.container').then((m) => m.TrashContainer),
  },
];
