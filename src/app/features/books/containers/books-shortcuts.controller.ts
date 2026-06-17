import { DestroyRef, inject } from '@angular/core';

import { ShortcutsService } from '@core/shortcuts/shortcuts.service';
import type { ShortcutBinding } from '@core/shortcuts/shortcuts.types';

export interface BooksShortcutHandlers {
  readonly newChapter: () => void;
  readonly moveChapterUp: () => void;
  readonly moveChapterDown: () => void;
  readonly toggleChapterList: () => void;
  readonly toggleFocus: () => void;
}

export const registerBooksShortcuts = (handlers: BooksShortcutHandlers): void => {
  const shortcuts = inject(ShortcutsService);
  const destroyRef = inject(DestroyRef);
  const bindings: ShortcutBinding[] = [
    {
      combo: 'Ctrl+Enter',
      labelKey: 'books.shortcuts.newChapter',
      scope: 'global',
      handler: handlers.newChapter,
    },
    {
      combo: 'Ctrl+Alt+ArrowUp',
      labelKey: 'books.shortcuts.moveChapterUp',
      scope: 'global',
      handler: handlers.moveChapterUp,
    },
    {
      combo: 'Ctrl+Alt+ArrowDown',
      labelKey: 'books.shortcuts.moveChapterDown',
      scope: 'global',
      handler: handlers.moveChapterDown,
    },
    {
      combo: 'Ctrl+\\',
      labelKey: 'books.shortcuts.toggleChapterList',
      scope: 'global',
      handler: handlers.toggleChapterList,
    },
    {
      combo: 'Ctrl+.',
      labelKey: 'books.shortcuts.toggleFocus',
      scope: 'global',
      handler: handlers.toggleFocus,
    },
  ];
  const unsubs = bindings.map((b) => shortcuts.register(b));
  destroyRef.onDestroy(() => unsubs.forEach((u) => u()));
};
