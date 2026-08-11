import type { ChalkLayer } from './chalk.types';

// why: local, session-scoped undo/redo for chalk strokes/layer actions.
//      Deliberately NOT wired to Ctrl+Z (TipTap owns that inside the editor) —
//      see docs/deferred/lists-images.md "Undo/redo dedicado para trazos".
//      Snapshots the whole `layers` array before each mutation; capped so a
//      long drawing session can't grow the stack unbounded.
const MAX_HISTORY = 50;

export interface ChalkHistoryState {
  readonly past: readonly (readonly ChalkLayer[])[];
  readonly future: readonly (readonly ChalkLayer[])[];
}

export const emptyChalkHistory: ChalkHistoryState = { past: [], future: [] };

export interface ChalkHistoryStep {
  readonly history: ChalkHistoryState;
  readonly layers: readonly ChalkLayer[];
}

export const recordChalkHistory = (
  history: ChalkHistoryState,
  current: readonly ChalkLayer[],
): ChalkHistoryState => ({
  past: [...history.past.slice(-(MAX_HISTORY - 1)), current],
  future: [],
});

export const undoChalkHistory = (
  history: ChalkHistoryState,
  current: readonly ChalkLayer[],
): ChalkHistoryStep | null => {
  const prev = history.past.at(-1);
  if (!prev) return null;
  return {
    history: {
      past: history.past.slice(0, -1),
      future: [...history.future, current].slice(-MAX_HISTORY),
    },
    layers: prev,
  };
};

export const redoChalkHistory = (
  history: ChalkHistoryState,
  current: readonly ChalkLayer[],
): ChalkHistoryStep | null => {
  const next = history.future.at(-1);
  if (!next) return null;
  return {
    history: {
      past: [...history.past, current].slice(-MAX_HISTORY),
      future: history.future.slice(0, -1),
    },
    layers: next,
  };
};
