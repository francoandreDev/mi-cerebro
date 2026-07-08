import type { Routes } from '@angular/router';

import { entityReadyResolver } from '@core/fs/entity-ready.guard';

export const notesRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./containers/notes-wall.container').then((m) => m.NotesWallContainer),
  },
  {
    path: ':id',
    loadComponent: () => import('./containers/notes.container').then((m) => m.NotesContainer),
    resolve: { ready: entityReadyResolver },
  },
];
