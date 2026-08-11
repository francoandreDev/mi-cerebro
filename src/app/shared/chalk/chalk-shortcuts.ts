import { DestroyRef, inject } from '@angular/core';

import { ShortcutsService } from '@core/shortcuts/shortcuts.service';
import type { ShortcutBinding } from '@core/shortcuts/shortcuts.types';

import type { ChalkColorId } from './chalk.types';
import { CHALK_COLORS } from './chalk.types';

export interface ChalkShortcutHandlers {
  readonly toggleMode: () => void;
  readonly pickChalk: () => void;
  readonly pickEraser: () => void;
  readonly pickColor: (color: ChalkColorId) => void;
  readonly undo: () => void;
  readonly redo: () => void;
}

// why: scope 'editable-safe' means ShortcutsService already skips these
//      while the TipTap editor (contentEditable) or any input/textarea has
//      focus — that's what keeps B/E/1-5 from hijacking normal typing.
//      Handlers additionally no-op unless chalk mode is on, so the letters
//      stay inert on the rest of the list page too.
export const registerChalkShortcuts = (handlers: ChalkShortcutHandlers): void => {
  const shortcuts = inject(ShortcutsService);
  const destroyRef = inject(DestroyRef);
  const bindings: ShortcutBinding[] = [
    {
      // why: combo uses 'Ctrl' (not 'Mod') — ShortcutsService's matcher
      //      already treats Ctrl/Cmd/Meta as the same modifier, covering
      //      Windows/Linux/macOS with one binding (see reglas.md §4.6/15).
      combo: 'Ctrl+Shift+T',
      labelKey: 'chalk.shortcuts.toggle',
      scope: 'editable-safe',
      handler: handlers.toggleMode,
    },
    {
      combo: 'b',
      labelKey: 'chalk.shortcuts.chalk',
      scope: 'editable-safe',
      handler: handlers.pickChalk,
    },
    {
      combo: 'e',
      labelKey: 'chalk.shortcuts.eraser',
      scope: 'editable-safe',
      handler: handlers.pickEraser,
    },
    {
      combo: '[',
      labelKey: 'chalk.shortcuts.undo',
      scope: 'editable-safe',
      handler: handlers.undo,
    },
    {
      combo: ']',
      labelKey: 'chalk.shortcuts.redo',
      scope: 'editable-safe',
      handler: handlers.redo,
    },
    ...CHALK_COLORS.map(
      (c, i): ShortcutBinding => ({
        combo: String(i + 1),
        labelKey: `chalk.shortcuts.color.${c.id}` as ShortcutBinding['labelKey'],
        scope: 'editable-safe',
        handler: () => handlers.pickColor(c.id),
      }),
    ),
  ];
  const unsubs = bindings.map((b) => shortcuts.register(b));
  destroyRef.onDestroy(() => unsubs.forEach((u) => u()));
};
