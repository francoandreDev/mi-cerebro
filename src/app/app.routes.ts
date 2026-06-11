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
    path: 'lists',
    loadChildren: () => import('./features/lists/lists.routes').then((m) => m.listsRoutes),
  },
  {
    path: 'writings',
    loadChildren: () => import('./features/writings/writings.routes').then((m) => m.writingsRoutes),
  },
  {
    path: 'books',
    loadChildren: () => import('./features/books/books.routes').then((m) => m.booksRoutes),
  },
  {
    path: 'images',
    loadChildren: () => import('./features/images/images.routes').then((m) => m.imagesRoutes),
  },
  {
    path: 'files',
    loadChildren: () => import('./features/files/files.routes').then((m) => m.filesRoutes),
  },
  {
    path: 'reminders',
    loadChildren: () =>
      import('./features/reminders/reminders.routes').then((m) => m.remindersRoutes),
  },
  {
    path: 'music',
    loadChildren: () => import('./features/music/music.routes').then((m) => m.musicRoutes),
  },
  {
    path: 'calendar',
    loadChildren: () => import('./features/calendar/calendar.routes').then((m) => m.calendarRoutes),
  },
  {
    path: 'trash',
    loadChildren: () => import('./features/trash/trash.routes').then((m) => m.trashRoutes),
  },
  {
    path: 'history',
    loadChildren: () => import('./features/history/history.routes').then((m) => m.historyRoutes),
  },
  {
    path: 'settings',
    loadChildren: () => import('./features/settings/settings.routes').then((m) => m.settingsRoutes),
  },
];
