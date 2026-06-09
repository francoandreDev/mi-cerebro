import type { Routes } from '@angular/router';

export const imagesRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./containers/galleries.container').then((m) => m.GalleriesContainer),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./containers/galleries.container').then((m) => m.GalleriesContainer),
  },
];
