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

export interface RemoteSecretsFile {
  readonly schemaVersion: typeof REMOTE_SECRETS_SCHEMA_VERSION;
  readonly remote: RemoteConfig | null;
  readonly lastPushAt?: string;
}

export const emptyRemoteSecrets = (): RemoteSecretsFile => ({
  schemaVersion: REMOTE_SECRETS_SCHEMA_VERSION,
  remote: null,
});

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
