import { DestroyRef, inject } from '@angular/core';

import { ShortcutsService } from '@core/shortcuts/shortcuts.service';
import type { ShortcutBinding } from '@core/shortcuts/shortcuts.types';

export interface ReaderShortcutHandlers {
  readonly prevChapter: () => void;
  readonly nextChapter: () => void;
  readonly prevPage: () => void;
  readonly nextPage: () => void;
  readonly toggleFocus: () => void;
  readonly toggleIndex: () => void;
  readonly toggleTts: () => void;
}

export const registerReaderShortcuts = (handlers: ReaderShortcutHandlers): void => {
  const shortcuts = inject(ShortcutsService);
  const destroyRef = inject(DestroyRef);
  const bindings: ShortcutBinding[] = [
    {
      combo: 'Alt+ArrowLeft',
      labelKey: 'books.shortcuts.prevChapter',
      scope: 'global',
      handler: handlers.prevChapter,
    },
    {
      combo: 'Alt+ArrowRight',
      labelKey: 'books.shortcuts.nextChapter',
      scope: 'global',
      handler: handlers.nextChapter,
    },
    {
      combo: 'PageUp',
      labelKey: 'books.shortcuts.prevPage',
      scope: 'global',
      handler: handlers.prevPage,
    },
    {
      combo: 'PageDown',
      labelKey: 'books.shortcuts.nextPage',
      scope: 'global',
      handler: handlers.nextPage,
    },
    {
      combo: 'Ctrl+.',
      labelKey: 'books.shortcuts.toggleFocus',
      scope: 'global',
      handler: handlers.toggleFocus,
    },
    {
      combo: "Ctrl+'",
      labelKey: 'books.shortcuts.toggleIndex',
      scope: 'global',
      handler: handlers.toggleIndex,
    },
    {
      combo: 'Ctrl+Alt+R',
      labelKey: 'books.shortcuts.toggleTts',
      scope: 'global',
      handler: handlers.toggleTts,
    },
  ];
  const unsubs = bindings.map((b) => shortcuts.register(b));
  destroyRef.onDestroy(() => unsubs.forEach((u) => u()));
};
