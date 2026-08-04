// 13e-ii — crypto-at-rest for the GitHub PAT in secrets.json. The key is a
// non-extractable AES-GCM CryptoKey generated once and stored directly in
// IndexedDB (the browser structured-clones CryptoKey objects opaquely — the
// raw bits are never readable, even by this code). No passphrase: unlocking
// is implicit to running in this browser profile. That protects the PAT
// against the workspace folder being copied/backed up/synced elsewhere
// without this profile's IndexedDB — it does not protect against someone
// with full access to this browser profile, which the app already trusts
// for everything else (FS permissions, custom themes, etc).

import type { IdbService } from '@core/idb/idb.service';

const KEY_STORE = 'crypto-keys' as const;
const KEY_ID = 'pat-device-key';
const ALGORITHM = 'AES-GCM';
const IV_BYTES = 12;

export interface EncryptedToken {
  readonly iv: string;
  readonly ciphertext: string;
}

async function getOrCreateDeviceKey(idb: IdbService): Promise<CryptoKey> {
  const existing = await idb.get<CryptoKey>(KEY_STORE, KEY_ID);
  if (existing) return existing;
  const key = await crypto.subtle.generateKey({ name: ALGORITHM, length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
  await idb.set(KEY_STORE, KEY_ID, key);
  return key;
}

export async function encryptToken(idb: IdbService, token: string): Promise<EncryptedToken> {
  const key = await getOrCreateDeviceKey(idb);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plainBytes = new TextEncoder().encode(token);
  const cipherBytes = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, plainBytes);
  return { iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(cipherBytes)) };
}

// Returns null if the ciphertext can't be decrypted with the current
// device key (e.g. site data was cleared and the key regenerated, or the
// secrets.json came from a different browser profile/machine) — callers
// treat that the same as "no PAT configured" and let the user re-paste it,
// rather than throwing.
export async function decryptToken(idb: IdbService, enc: EncryptedToken): Promise<string | null> {
  try {
    const key = await getOrCreateDeviceKey(idb);
    const iv = fromBase64(enc.iv);
    const cipherBytes = fromBase64(enc.ciphertext);
    const plainBytes = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, cipherBytes);
    return new TextDecoder().decode(plainBytes);
  } catch {
    return null;
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
