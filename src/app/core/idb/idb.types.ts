// Names of the IndexedDB object stores used by the app.
// Adding a new store requires bumping IDB_VERSION in idb.service.ts.

export const IDB_STORES = [
  'drafts',
  'theme-custom',
  'search-index',
  'error-log',
  'crypto-keys',
] as const;

export type IdbStore = (typeof IDB_STORES)[number];

export interface DraftRecord<P = unknown> {
  readonly id: string;
  readonly kind: string;
  readonly payload: P;
  readonly updatedAt: string;
}

export interface LoggedErrorRecord {
  readonly code: string;
  readonly message: string;
  readonly severity: string;
  readonly context: string | undefined;
  readonly loggedAt: string;
}
