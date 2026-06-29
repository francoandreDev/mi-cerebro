import { between } from '@core/ordering/fractional-position';

import type { BookSummary } from '../models/book.types';

export interface MoveTarget {
  readonly folder: string;
  readonly position: string;
}

const normPos = (p: string | undefined): string | null => (p === undefined || p === '' ? null : p);

export const readDragId = (event: DragEvent, fallback: string | null): string | null => {
  const fromData = event.dataTransfer?.getData('text/plain') ?? '';
  return fromData !== '' ? fromData : fallback;
};

// why: drop sobre el fondo del shelf → append al final de ese estante.
export const shelfDropTarget = (
  summaries: readonly BookSummary[],
  folder: string,
  draggedId: string,
): MoveTarget => {
  const list = summaries.filter((s) => s.folder === folder && s.id !== draggedId);
  const last = list.length > 0 ? (list[list.length - 1] ?? null) : null;
  return { folder, position: between(normPos(last?.position), null) };
};

// why: drop sobre un libro → insert antes de ese libro. La posición nueva va
//      entre el libro previo (en el mismo estante, sin contar el arrastrado)
//      y el libro target.
export const slotDropTarget = (
  summaries: readonly BookSummary[],
  targetId: string,
  draggedId: string,
): MoveTarget | null => {
  const target = summaries.find((s) => s.id === targetId);
  if (!target) return null;
  const list = summaries.filter((s) => s.folder === target.folder && s.id !== draggedId);
  const tIdx = list.findIndex((s) => s.id === targetId);
  const prev = tIdx > 0 ? (list[tIdx - 1] ?? null) : null;
  return {
    folder: target.folder,
    position: between(normPos(prev?.position), normPos(target.position)),
  };
};
