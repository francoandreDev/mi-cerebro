import { inject } from '@angular/core';

import type { TranslationKey } from '@core/i18n/i18n.types';
import { ShortcutsService } from '@core/shortcuts/shortcuts.service';

import { createListCursor, type ListCursorController } from './list-cursor';

export interface RowNavLabels {
  readonly next: TranslationKey;
  readonly prev: TranslationKey;
  readonly open: TranslationKey;
  readonly toggle: TranslationKey;
  readonly del: TranslationKey;
}

export interface RowNavHandlers {
  readonly rowIds: () => readonly string[];
  readonly onToggle: (id: string) => void;
  readonly onOpen: (id: string) => void;
  readonly onDelete: (id: string) => void;
}

// why: shared J/K/Space/E/Del wiring for any feature that grows a real
//      linear list view — reminders originated the 5-binding pattern inline
//      (see reminders.container.ts registerShortcuts()); tasks and goals
//      reuse it verbatim instead of re-copying the same block, and both
//      containers are already at/over the 300-line hard limit (§4.4), so
//      new logic goes in a separate file rather than growing them further.
export class RowNavController {
  private readonly shortcuts = inject(ShortcutsService);
  readonly cursor: ListCursorController = createListCursor();

  constructor(
    private readonly handlers: RowNavHandlers,
    private readonly labels: RowNavLabels,
    private readonly pageScope: string,
  ) {}

  register(): () => void {
    const bindings = [
      {
        combo: 'j',
        labelKey: this.labels.next,
        handler: () => this.cursor.move(1, this.handlers.rowIds()),
      },
      {
        combo: 'k',
        labelKey: this.labels.prev,
        handler: () => this.cursor.move(-1, this.handlers.rowIds()),
      },
      {
        combo: 'e',
        labelKey: this.labels.open,
        handler: () => this.withFocused(this.handlers.onOpen),
      },
      {
        combo: ' ',
        labelKey: this.labels.toggle,
        handler: () => this.withFocused(this.handlers.onToggle),
      },
      {
        combo: 'Delete',
        labelKey: this.labels.del,
        handler: () => this.withFocused(this.handlers.onDelete),
      },
    ] as const;
    const unregs = bindings.map((b) =>
      this.shortcuts.register({ ...b, scope: 'editable-safe', pageScope: this.pageScope }),
    );
    return () => unregs.forEach((unreg) => unreg());
  }

  private withFocused(fn: (id: string) => void): void {
    const id = this.cursor.focusedId();
    if (id) fn(id);
  }
}
