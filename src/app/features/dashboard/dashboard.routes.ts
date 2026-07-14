import type { Routes } from '@angular/router';

export const dashboardRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./containers/dashboard.container').then((m) => m.DashboardContainer),
  },
];
