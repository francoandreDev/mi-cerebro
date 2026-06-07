import type { Routes } from '@angular/router';

export const notesRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./containers/notes.container').then((m) => m.NotesContainer),
  },
  {
    path: ':id',
    loadComponent: () => import('./containers/notes.container').then((m) => m.NotesContainer),
  },
];
