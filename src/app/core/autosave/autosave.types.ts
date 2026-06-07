export type DraftPayloadFactory<P> = () => P;

export interface AutosaveOptions {
  // Debounce in ms before the pending payload is flushed to IDB.
  readonly debounceMs?: number;
}

export const DEFAULT_DEBOUNCE_MS = 2500;
