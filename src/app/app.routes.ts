import type { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'notes' },
  {
    path: 'notes',
    loadChildren: () => import('./features/notes/notes.routes').then((m) => m.notesRoutes),
  },
  {
    path: 'tasks',
    loadChildren: () => import('./features/tasks/tasks.routes').then((m) => m.tasksRoutes),
  },
  {
    path: 'goals',
    loadChildren: () => import('./features/goals/goals.routes').then((m) => m.goalsRoutes),
  },
  {
    path: 'trash',
    loadChildren: () => import('./features/trash/trash.routes').then((m) => m.trashRoutes),
  },
];
