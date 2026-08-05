import { computed, signal, type Signal } from '@angular/core';

// why: shared "selected id set" primitive for shift-click multi-select UIs
//      (see docs/deferred/reminders-goals.md — "Multi-select de pasos para
//      acciones por lote"). Tracks ids, not indices/objects, so it survives
//      the underlying list re-rendering out from under it — same rationale
//      as `createListCursor` (list-cursor.ts) for the focused-row case.
export interface MultiSelectController {
  readonly selectedIds: Signal<ReadonlySet<string>>;
  readonly count: Signal<number>;
  isSelected(id: string): boolean;
  toggle(id: string): void;
  clear(): void;
  // why: bulk replace for rectangle/lasso selection — a drag gesture picks
  //      up a whole batch in one go, so it needs to set the set directly
  //      instead of toggling ids one at a time.
  setSelected(ids: Iterable<string>): void;
}

export const createMultiSelect = (): MultiSelectController => {
  const selectedIds = signal<ReadonlySet<string>>(new Set());
  return {
    selectedIds,
    count: computed(() => selectedIds().size),
    isSelected: (id) => selectedIds().has(id),
    toggle(id) {
      const next = new Set(selectedIds());
      if (next.has(id)) next.delete(id);
      else next.add(id);
      selectedIds.set(next);
    },
    clear() {
      if (selectedIds().size === 0) return;
      selectedIds.set(new Set());
    },
    setSelected(ids) {
      selectedIds.set(new Set(ids));
    },
  };
};
