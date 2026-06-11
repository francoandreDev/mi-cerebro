import type { Routes } from '@angular/router';

export const settingsRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./containers/settings.container').then((m) => m.SettingsContainer),
  },
];
