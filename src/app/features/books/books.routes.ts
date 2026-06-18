import type { Routes } from '@angular/router';

export const booksRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./containers/bookshelf.container').then((m) => m.BookshelfContainer),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./containers/book-open.container').then((m) => m.BookOpenContainer),
  },
  {
    path: ':id/:chapterId',
    loadComponent: () =>
      import('./containers/book-reader.container').then((m) => m.BookReaderContainer),
  },
];
