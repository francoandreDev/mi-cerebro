import { signal, type Signal } from '@angular/core';

import { MC_INTERNAL_DND_TYPE } from './dnd';

// why: every "drag a card between zones" feature in the repo (tasks-garden
//      buckets, future chalk layers reorder, future lists items DnD) was
//      hand-rolling the same boilerplate: dragstart sets a signal + the custom
//      mime, dragend clears it, dragover preventDefault + dropEffect,
//      dragenter/leave with a counter so child elements don't flicker the
//      highlight, drop reads the id back. The controller owns the two signals
//      (`draggingId`, `overZone`) and the handlers. Consumers wire them in
//      templates and react to `onDrop` with their own move logic.
//
//      Scope is HTML5 native DnD only. Pointer-based drags (custom drag
//      image, organic animations, mobile touch) stay per-feature on purpose
//      so this helper stays small and accessible — `draggable=true` gives
//      focus + keyboard fallbacks for free.
export interface DndController<TZone extends string = string> {
  readonly draggingId: Signal<string | null>;
  readonly overZone: Signal<TZone | null>;
  onDragStart(event: DragEvent, id: string): void;
  onDragEnd(): void;
  onDragOver(event: DragEvent): void;
  onDragEnter(zone: TZone): void;
  onDragLeave(zone: TZone): void;
  onDrop(zone: TZone): { id: string; zone: TZone } | null;
}

export const createDndController = <TZone extends string = string>(): DndController<TZone> => {
  const draggingId = signal<string | null>(null);
  const overZone = signal<TZone | null>(null);
  // why: dragenter/leave fire for every child element under the zone, so a
  //      naive "set on enter, clear on leave" makes the highlight flicker as
  //      the pointer crosses interior cards. Counting depth per zone is the
  //      standard fix.
  const depth = new Map<TZone, number>();

  const reset = (): void => {
    draggingId.set(null);
    overZone.set(null);
    depth.clear();
  };

  return {
    draggingId,
    overZone,
    onDragStart(event, id) {
      if (!event.dataTransfer) return;
      event.dataTransfer.setData(MC_INTERNAL_DND_TYPE, id);
      // why: text/plain mirrors the id so a drop on an external editor pastes
      //      something readable instead of nothing.
      event.dataTransfer.setData('text/plain', id);
      event.dataTransfer.effectAllowed = 'move';
      draggingId.set(id);
    },
    onDragEnd() {
      reset();
    },
    onDragOver(event) {
      // why: without preventDefault the browser refuses the drop silently —
      //      classic bug when wiring DnD by hand.
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    },
    onDragEnter(zone) {
      depth.set(zone, (depth.get(zone) ?? 0) + 1);
      overZone.set(zone);
    },
    onDragLeave(zone) {
      const next = (depth.get(zone) ?? 1) - 1;
      if (next <= 0) {
        depth.delete(zone);
        if (overZone() === zone) overZone.set(null);
      } else {
        depth.set(zone, next);
      }
    },
    onDrop(zone) {
      const id = draggingId();
      reset();
      return id ? { id, zone } : null;
    },
  };
};
