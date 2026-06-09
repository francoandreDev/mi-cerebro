import type { Routes } from '@angular/router';

export const remindersRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./containers/reminders.container').then((m) => m.RemindersContainer),
  },
];
