import { signal, type Signal } from '@angular/core';

// why: shared "focused row" primitive for J/K-style keyboard navigation
//      across list views (reminders, and any future list that has a real
//      row order — see docs/deferred/reminders-goals.md). Tracks the
//      focused *id*, not an index, so it survives the list reordering or
//      being filtered out from under it — an index would point at the
//      wrong row the moment the filter changes.
export interface ListCursorController {
  readonly focusedId: Signal<string | null>;
  move(delta: number, ids: readonly string[]): void;
  clear(): void;
}

export const createListCursor = (): ListCursorController => {
  const focusedId = signal<string | null>(null);
  return {
    focusedId,
    move(delta, ids) {
      if (ids.length === 0) {
        focusedId.set(null);
        return;
      }
      const current = focusedId();
      const idx = current ? ids.indexOf(current) : -1;
      const next = idx < 0 ? (delta > 0 ? 0 : ids.length - 1) : mod(idx + delta, ids.length);
      focusedId.set(ids[next] ?? null);
    },
    clear() {
      focusedId.set(null);
    },
  };
};

const mod = (n: number, m: number): number => ((n % m) + m) % m;
