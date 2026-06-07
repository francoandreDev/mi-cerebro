export type DraftPayloadFactory<P> = () => P;

export type OnFlushFn<P> = (payload: P) => Promise<void> | void;

export interface AutosaveOptions<P> {
  // Debounce in ms before the pending payload is flushed.
  readonly debounceMs?: number;
  // why: callback the service invokes after persisting the IDB draft. The
  //      caller uses it to write the canonical entity to disk on the same
  //      cadence as the draft, without juggling a second debounce.
  readonly onFlush?: OnFlushFn<P>;
}

export const DEFAULT_DEBOUNCE_MS = 2500;
