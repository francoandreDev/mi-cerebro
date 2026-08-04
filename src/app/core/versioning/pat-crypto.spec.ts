import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { IdbService } from '@core/idb/idb.service';

import { decryptToken, encryptToken } from './pat-crypto';

describe('pat-crypto', () => {
  let idb: IdbService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    idb = TestBed.inject(IdbService);
  });

  it('encrypts to a ciphertext that does not contain the plaintext', async () => {
    const enc = await encryptToken(idb, 'ghp_supersecret');
    expect(enc.ciphertext).not.toContain('ghp_supersecret');
    expect(enc.iv.length).toBeGreaterThan(0);
  });

  it('decrypts back to the original token', async () => {
    const enc = await encryptToken(idb, 'ghp_supersecret');
    expect(await decryptToken(idb, enc)).toBe('ghp_supersecret');
  });

  it('reuses the same device key across calls (persisted in IndexedDB)', async () => {
    const first = await encryptToken(idb, 'a');
    // A second IdbService instance (fresh TestBed injection) still reads
    // the same underlying IndexedDB, so it must decrypt what the first
    // encrypted — the key isn't regenerated per instance.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const idb2 = TestBed.inject(IdbService);
    expect(await decryptToken(idb2, first)).toBe('a');
  });

  it('two encryptions of the same token produce different ciphertext (random IV)', async () => {
    const a = await encryptToken(idb, 'same-token');
    const b = await encryptToken(idb, 'same-token');
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(await decryptToken(idb, a)).toBe('same-token');
    expect(await decryptToken(idb, b)).toBe('same-token');
  });

  it('returns null for corrupted ciphertext instead of throwing', async () => {
    const enc = await encryptToken(idb, 'x');
    const corrupted = { iv: enc.iv, ciphertext: 'not-valid-base64-ciphertext!!' };
    await expect(decryptToken(idb, corrupted)).resolves.toBeNull();
  });

  it('returns null once the device key is cleared from IndexedDB', async () => {
    const enc = await encryptToken(idb, 'x');
    await idb.clear('crypto-keys');
    expect(await decryptToken(idb, enc)).toBeNull();
  });
});
