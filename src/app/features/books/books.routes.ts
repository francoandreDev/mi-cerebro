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
      import('./containers/book-desk.container').then((m) => m.BookDeskContainer),
  },
  {
    path: ':id/:chapterId',
    loadComponent: () =>
      import('./containers/book-reader.container').then((m) => m.BookReaderContainer),
  },
];
