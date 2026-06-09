import type { Routes } from '@angular/router';

export const musicRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./containers/music.container').then((m) => m.MusicContainer),
  },
];
