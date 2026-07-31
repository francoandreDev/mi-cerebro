// 13e — model for the GitHub remote bridge. The config lives in
// `.mi-cerebro/secrets.json` (gitignored by default — never enters the
// repo tree). Schema version is here so future additions (refresh tokens,
// multiple remotes) don't silently break older files.

export const REMOTE_SECRETS_FILE = '.mi-cerebro/secrets.json';
export const REMOTE_SECRETS_SCHEMA_VERSION = 1 as const;

export interface RemoteConfig {
  readonly url: string;
  readonly token: string;
}

// why: "N envíos hoy" (docs/deferred/sync.md) — count resets when `date`
//      (local YYYY-MM-DD, see localDateKey) no longer matches today.
export interface DispatchCount {
  readonly date: string;
  readonly count: number;
}

export interface RemoteSecretsFile {
  readonly schemaVersion: typeof REMOTE_SECRETS_SCHEMA_VERSION;
  readonly remote: RemoteConfig | null;
  readonly lastPushAt?: string;
  readonly dispatchCount?: DispatchCount;
}

export const emptyRemoteSecrets = (): RemoteSecretsFile => ({
  schemaVersion: REMOTE_SECRETS_SCHEMA_VERSION,
  remote: null,
});

// why: local (not UTC) calendar day, so the counter rolls over at
//      midnight in the user's own timezone, not at UTC midnight.
export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface PushOutcome {
  readonly ref: string;
  readonly status: 'ok' | 'up-to-date';
  readonly remoteRef: string;
}

export type Facet = 'main' | 'comments' | 'draft';
export const FACETS: readonly Facet[] = ['main', 'comments', 'draft'] as const;

export type RefSyncStatus = 'ok' | 'up-to-date' | 'error' | 'absent';

export interface RefSyncOutcome {
  readonly variantId: string;
  readonly facet: Facet;
  readonly ref: string;
  readonly remoteRef: string;
  readonly status: RefSyncStatus;
  readonly error?: string;
}

export interface BulkSyncResult {
  readonly outcomes: readonly RefSyncOutcome[];
  readonly errorCount: number;
  readonly successCount: number;
}
