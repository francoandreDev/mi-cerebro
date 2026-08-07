// 13e-i — read/write `.mi-cerebro/secrets.json` and keep the
// `.gitignore` line for it in place. Pure-ish: takes a `FileSystem`-
// like object (and, since 13e-ii, an `IdbService` instance) as params
// instead of injecting them, so tests can pass fakes without DI. The
// atomic-write promise comes from the caller (FsService.writeFileAtomic
// in prod, a stub in tests).
//
// 13e-ii — the on-disk `remote.token` is an AES-GCM envelope (see
// pat-crypto.ts), encrypted/decrypted at this read/write boundary only.
// v1 files (plaintext token) are still readable — read as-is, flagged
// `migrated: true` so the caller re-persists them encrypted.

import type { IdbService } from '@core/idb/idb.service';

import { decryptToken, encryptToken, type EncryptedToken } from './pat-crypto';
import {
  REMOTE_SECRETS_FILE,
  REMOTE_SECRETS_SCHEMA_VERSION,
  emptyRemoteSecrets,
  type RemoteSecretsFile,
} from './remote.types';

const GITIGNORE_FILE = '.gitignore';
const GITIGNORE_LINE = '/.mi-cerebro/secrets.json';
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();
const URL_RE = /^https:\/\/github\.com\/[^/]+\/[^/]+?(?:\.git)?\/?$/i;
const PROXY_URL_RE = /^https:\/\/[^/\s]+\/?$/i;

export function isValidRemoteUrl(url: string): boolean {
  return URL_RE.test(url.trim());
}

// why: not scoped to a specific host like isValidRemoteUrl — a self-hosted
//      proxy can live on any domain (Cloudflare Workers, Deno Deploy,
//      etc.). Just needs to be a bare https origin (isomorphic-git appends
//      the target path itself).
export function isValidProxyUrl(url: string): boolean {
  return PROXY_URL_RE.test(url.trim());
}

export interface ConfigFs {
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, content: Uint8Array): Promise<void>;
}

export interface ReadRemoteSecretsResult {
  readonly file: RemoteSecretsFile;
  // why: true when the on-disk shape was an older schema (v1 plaintext
  //      token) upgraded in memory to the current one — the caller should
  //      persist it back so the plaintext-on-disk window closes promptly
  //      instead of lingering until the next unrelated write.
  readonly migrated: boolean;
}

export async function readRemoteSecrets(
  fs: ConfigFs,
  idb: IdbService,
): Promise<ReadRemoteSecretsResult> {
  let bytes: Uint8Array;
  try {
    bytes = await fs.readFile(REMOTE_SECRETS_FILE);
  } catch {
    return { file: emptyRemoteSecrets(), migrated: false };
  }
  if (bytes.byteLength === 0) return { file: emptyRemoteSecrets(), migrated: false };
  try {
    const parsed = JSON.parse(TEXT_DECODER.decode(bytes)) as {
      schemaVersion?: unknown;
      remote?: unknown;
      lastPushAt?: unknown;
      dispatchCount?: unknown;
    };
    const dispatchCount = normalizeDispatchCount(parsed.dispatchCount);
    const rest = {
      ...(typeof parsed.lastPushAt === 'string' ? { lastPushAt: parsed.lastPushAt } : {}),
      ...(dispatchCount ? { dispatchCount } : {}),
    };
    if (parsed.schemaVersion === 1) {
      const remote = normalizeLegacyRemote(parsed.remote);
      return {
        file: { schemaVersion: REMOTE_SECRETS_SCHEMA_VERSION, remote, ...rest },
        migrated: remote !== null,
      };
    }
    if (parsed.schemaVersion === REMOTE_SECRETS_SCHEMA_VERSION) {
      const remote = await normalizeEncryptedRemote(parsed.remote, idb);
      return {
        file: { schemaVersion: REMOTE_SECRETS_SCHEMA_VERSION, remote, ...rest },
        migrated: false,
      };
    }
    return { file: emptyRemoteSecrets(), migrated: false };
  } catch {
    return { file: emptyRemoteSecrets(), migrated: false };
  }
}

export async function writeRemoteSecrets(
  fs: ConfigFs,
  idb: IdbService,
  file: RemoteSecretsFile,
): Promise<void> {
  const onDisk = {
    schemaVersion: REMOTE_SECRETS_SCHEMA_VERSION,
    remote: file.remote
      ? {
          url: file.remote.url,
          token: await encryptToken(idb, file.remote.token),
          ...(file.remote.corsProxyUrl ? { corsProxyUrl: file.remote.corsProxyUrl } : {}),
        }
      : null,
    ...(file.lastPushAt ? { lastPushAt: file.lastPushAt } : {}),
    ...(file.dispatchCount ? { dispatchCount: file.dispatchCount } : {}),
  };
  const bytes = TEXT_ENCODER.encode(JSON.stringify(onDisk, null, 2));
  await fs.writeFile(REMOTE_SECRETS_FILE, bytes);
}

// why: the secrets file path must never enter the git tree. The function
//      is idempotent — calling it twice leaves a single line, regardless
//      of trailing whitespace or pre-existing comments.
export async function ensureGitignoredSecrets(fs: ConfigFs): Promise<void> {
  let current: string;
  try {
    const bytes = await fs.readFile(GITIGNORE_FILE);
    current = TEXT_DECODER.decode(bytes);
  } catch {
    current = '';
  }
  const lines = current.split('\n').map((l) => l.trim());
  if (lines.includes(GITIGNORE_LINE) || lines.includes(GITIGNORE_LINE.replace(/^\//, ''))) return;
  const suffix = current.endsWith('\n') || current.length === 0 ? '' : '\n';
  const next = `${current}${suffix}${GITIGNORE_LINE}\n`;
  await fs.writeFile(GITIGNORE_FILE, TEXT_ENCODER.encode(next));
}

function normalizeDispatchCount(dc: unknown): RemoteSecretsFile['dispatchCount'] {
  if (!dc || typeof dc !== 'object') return undefined;
  const d = dc as { date?: unknown; count?: unknown };
  if (typeof d.date !== 'string' || typeof d.count !== 'number' || !Number.isFinite(d.count)) {
    return undefined;
  }
  return { date: d.date, count: Math.max(0, Math.round(d.count)) };
}

function normalizeCorsProxyUrl(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function normalizeLegacyRemote(remote: unknown): RemoteSecretsFile['remote'] {
  if (!remote || typeof remote !== 'object') return null;
  const r = remote as { url?: unknown; token?: unknown; corsProxyUrl?: unknown };
  if (typeof r.url !== 'string' || typeof r.token !== 'string') return null;
  if (r.url.length === 0 || r.token.length === 0) return null;
  const corsProxyUrl = normalizeCorsProxyUrl(r.corsProxyUrl);
  return { url: r.url, token: r.token, ...(corsProxyUrl ? { corsProxyUrl } : {}) };
}

async function normalizeEncryptedRemote(
  remote: unknown,
  idb: IdbService,
): Promise<RemoteSecretsFile['remote']> {
  if (!remote || typeof remote !== 'object') return null;
  const r = remote as { url?: unknown; token?: unknown; corsProxyUrl?: unknown };
  if (typeof r.url !== 'string' || r.url.length === 0 || !r.token || typeof r.token !== 'object') {
    return null;
  }
  const enc = r.token as { iv?: unknown; ciphertext?: unknown };
  if (typeof enc.iv !== 'string' || typeof enc.ciphertext !== 'string') return null;
  const token = await decryptToken(idb, {
    iv: enc.iv,
    ciphertext: enc.ciphertext,
  } as EncryptedToken);
  if (token === null || token.length === 0) return null;
  const corsProxyUrl = normalizeCorsProxyUrl(r.corsProxyUrl);
  return { url: r.url, token, ...(corsProxyUrl ? { corsProxyUrl } : {}) };
}
