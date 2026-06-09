import type { Routes } from '@angular/router';

export const filesRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./containers/files.container').then((m) => m.FilesContainer),
  },
  {
    path: ':id',
    loadComponent: () => import('./containers/files.container').then((m) => m.FilesContainer),
  },
];
