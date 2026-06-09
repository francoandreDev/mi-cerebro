import type { Routes } from '@angular/router';

export const calendarRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./containers/calendar.container').then((m) => m.CalendarContainer),
  },
];
