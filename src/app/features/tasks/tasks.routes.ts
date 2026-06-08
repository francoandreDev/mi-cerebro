import type { Routes } from '@angular/router';

export const tasksRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./containers/tasks.container').then((m) => m.TasksContainer),
  },
  {
    path: ':id',
    loadComponent: () => import('./containers/tasks.container').then((m) => m.TasksContainer),
  },
];
