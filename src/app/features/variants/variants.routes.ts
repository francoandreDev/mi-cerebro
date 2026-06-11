import type { Routes } from '@angular/router';

export const variantsRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./containers/variants.container').then((m) => m.VariantsContainer),
  },
];
