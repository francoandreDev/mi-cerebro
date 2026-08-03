import type { Routes } from '@angular/router';
import { provideNgtRenderer } from 'angular-three/dom';

import { entityReadyResolver } from '@core/fs/entity-ready.guard';

export const imagesRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./containers/galleries-index.container').then((m) => m.GalleriesIndexContainer),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./containers/galleries.container').then((m) => m.GalleriesContainer),
    resolve: { ready: entityReadyResolver },
    // why: the Angular Three custom renderer (museum-room 3D view) is only
    //      needed on this route — scoping it here instead of app.config.ts
    //      keeps its RendererFactory2 override out of every other page.
    providers: [provideNgtRenderer()],
  },
];
