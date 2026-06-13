// 13e-i — read/write `.mi-cerebro/secrets.json` and keep the
// `.gitignore` line for it in place. Pure-ish: takes a `FileSystem`-
// like object so tests can pass a fake without DI. The atomic-write
// promise comes from the caller (FsService.writeFileAtomic in prod, a
// stub in tests).

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

export function isValidRemoteUrl(url: string): boolean {
  return URL_RE.test(url.trim());
}

export interface ConfigFs {
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, content: Uint8Array): Promise<void>;
}

export async function readRemoteSecrets(fs: ConfigFs): Promise<RemoteSecretsFile> {
  let bytes: Uint8Array;
  try {
    bytes = await fs.readFile(REMOTE_SECRETS_FILE);
  } catch {
    return emptyRemoteSecrets();
  }
  if (bytes.byteLength === 0) return emptyRemoteSecrets();
  try {
    const parsed = JSON.parse(TEXT_DECODER.decode(bytes)) as Partial<RemoteSecretsFile>;
    if (parsed.schemaVersion !== REMOTE_SECRETS_SCHEMA_VERSION) return emptyRemoteSecrets();
    return {
      schemaVersion: REMOTE_SECRETS_SCHEMA_VERSION,
      remote: normalizeRemote(parsed.remote ?? null),
      ...(parsed.lastPushAt ? { lastPushAt: parsed.lastPushAt } : {}),
    };
  } catch {
    return emptyRemoteSecrets();
  }
}

export async function writeRemoteSecrets(fs: ConfigFs, file: RemoteSecretsFile): Promise<void> {
  const bytes = TEXT_ENCODER.encode(JSON.stringify(file, null, 2));
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

function normalizeRemote(remote: unknown): RemoteSecretsFile['remote'] {
  if (!remote || typeof remote !== 'object') return null;
  const r = remote as { url?: unknown; token?: unknown };
  if (typeof r.url !== 'string' || typeof r.token !== 'string') return null;
  if (r.url.length === 0 || r.token.length === 0) return null;
  return { url: r.url, token: r.token };
}
