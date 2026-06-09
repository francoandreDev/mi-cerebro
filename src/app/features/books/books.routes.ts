import type { Routes } from '@angular/router';

export const booksRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./containers/books.container').then((m) => m.BooksContainer),
  },
  {
    path: ':id',
    loadComponent: () => import('./containers/books.container').then((m) => m.BooksContainer),
  },
  {
    path: ':id/:chapterId',
    loadComponent: () => import('./containers/books.container').then((m) => m.BooksContainer),
  },
];
