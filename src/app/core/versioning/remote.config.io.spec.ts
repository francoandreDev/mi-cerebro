// 13e-i — config IO + URL validation tests. No DI for the fs layer; the
// in-memory fs stub matches the ConfigFs interface so we exercise the
// real code path. IdbService (13e-ii, token encryption) comes from
// TestBed since pat-crypto.ts needs a real IndexedDB (fake-indexeddb in
// tests) to store the device key.

import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { IdbService } from '@core/idb/idb.service';

import type { ConfigFs } from './remote.config.io';
import {
  ensureGitignoredSecrets,
  isValidProxyUrl,
  isValidRemoteUrl,
  readRemoteSecrets,
  writeRemoteSecrets,
} from './remote.config.io';
import { REMOTE_SECRETS_SCHEMA_VERSION, localDateKey } from './remote.types';

class MemFs implements ConfigFs {
  private readonly files = new Map<string, Uint8Array>();

  async readFile(path: string): Promise<Uint8Array> {
    const v = this.files.get(path);
    if (!v) throw new Error(`not found: ${path}`);
    return v;
  }
  async writeFile(path: string, content: Uint8Array): Promise<void> {
    this.files.set(path, content);
  }
  text(path: string): string {
    const v = this.files.get(path);
    return v ? new TextDecoder().decode(v) : '';
  }
  has(path: string): boolean {
    return this.files.has(path);
  }
}

function idb(): IdbService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({});
  return TestBed.inject(IdbService);
}

describe('isValidRemoteUrl', () => {
  it.each([
    ['https://github.com/owner/repo.git', true],
    ['https://github.com/owner/repo', true],
    ['https://github.com/owner/repo/', true],
    ['https://github.com/Owner-1/repo-name.git', true],
    ['http://github.com/owner/repo.git', false],
    ['https://gitlab.com/owner/repo.git', false],
    ['github.com/owner/repo', false],
    ['', false],
    ['https://github.com/owner', false],
  ])('isValidRemoteUrl(%s) === %s', (url, expected) => {
    expect(isValidRemoteUrl(url)).toBe(expected);
  });
});

describe('isValidProxyUrl', () => {
  it.each([
    ['https://mi-cerebro-cors-proxy.example.workers.dev', true],
    ['https://mi-cerebro-cors-proxy.example.workers.dev/', true],
    ['http://mi-cerebro-cors-proxy.example.workers.dev', false],
    ['mi-cerebro-cors-proxy.example.workers.dev', false],
    ['https://a/b', false],
    ['', false],
  ])('isValidProxyUrl(%s) === %s', (url, expected) => {
    expect(isValidProxyUrl(url)).toBe(expected);
  });
});

describe('readRemoteSecrets', () => {
  it('returns empty file when secrets.json is missing', async () => {
    const fs = new MemFs();
    const { file, migrated } = await readRemoteSecrets(fs, idb());
    expect(file.remote).toBeNull();
    expect(file.schemaVersion).toBe(REMOTE_SECRETS_SCHEMA_VERSION);
    expect(migrated).toBe(false);
  });

  it('round-trips a configured file, storing the token encrypted on disk', async () => {
    const fs = new MemFs();
    const store = idb();
    await writeRemoteSecrets(fs, store, {
      schemaVersion: REMOTE_SECRETS_SCHEMA_VERSION,
      remote: { url: 'https://github.com/owner/repo.git', token: 'ghp_abc' },
    });
    expect(fs.text('.mi-cerebro/secrets.json')).not.toContain('ghp_abc');
    const { file } = await readRemoteSecrets(fs, store);
    expect(file.remote).toEqual({ url: 'https://github.com/owner/repo.git', token: 'ghp_abc' });
  });

  it('round-trips an optional corsProxyUrl alongside the remote config', async () => {
    const fs = new MemFs();
    const store = idb();
    await writeRemoteSecrets(fs, store, {
      schemaVersion: REMOTE_SECRETS_SCHEMA_VERSION,
      remote: {
        url: 'https://github.com/owner/repo.git',
        token: 'ghp_abc',
        corsProxyUrl: 'https://mi-cerebro-cors-proxy.example.workers.dev',
      },
    });
    const { file } = await readRemoteSecrets(fs, store);
    expect(file.remote).toEqual({
      url: 'https://github.com/owner/repo.git',
      token: 'ghp_abc',
      corsProxyUrl: 'https://mi-cerebro-cors-proxy.example.workers.dev',
    });
  });

  it('omits corsProxyUrl from the round-tripped remote when not configured', async () => {
    const fs = new MemFs();
    const store = idb();
    await writeRemoteSecrets(fs, store, {
      schemaVersion: REMOTE_SECRETS_SCHEMA_VERSION,
      remote: { url: 'https://github.com/owner/repo.git', token: 'ghp_abc' },
    });
    const { file } = await readRemoteSecrets(fs, store);
    expect(file.remote?.corsProxyUrl).toBeUndefined();
  });

  it('discards files with future schemaVersion', async () => {
    const fs = new MemFs();
    await fs.writeFile(
      '.mi-cerebro/secrets.json',
      new TextEncoder().encode(
        JSON.stringify({ schemaVersion: 999, remote: { url: 'x', token: 'y' } }),
      ),
    );
    expect((await readRemoteSecrets(fs, idb())).file.remote).toBeNull();
  });

  it('discards malformed remote payloads', async () => {
    const fs = new MemFs();
    await fs.writeFile(
      '.mi-cerebro/secrets.json',
      new TextEncoder().encode(
        JSON.stringify({ schemaVersion: REMOTE_SECRETS_SCHEMA_VERSION, remote: { url: 'x' } }),
      ),
    );
    expect((await readRemoteSecrets(fs, idb())).file.remote).toBeNull();
  });

  it('round-trips dispatchCount ("N envíos hoy")', async () => {
    const fs = new MemFs();
    await writeRemoteSecrets(fs, idb(), {
      schemaVersion: REMOTE_SECRETS_SCHEMA_VERSION,
      remote: null,
      dispatchCount: { date: '2026-07-31', count: 3 },
    });
    const { file } = await readRemoteSecrets(fs, idb());
    expect(file.dispatchCount).toEqual({ date: '2026-07-31', count: 3 });
  });

  it('discards a malformed dispatchCount instead of failing the whole read', async () => {
    const fs = new MemFs();
    await fs.writeFile(
      '.mi-cerebro/secrets.json',
      new TextEncoder().encode(
        JSON.stringify({
          schemaVersion: REMOTE_SECRETS_SCHEMA_VERSION,
          remote: null,
          dispatchCount: { date: 5, count: 'x' },
        }),
      ),
    );
    const { file } = await readRemoteSecrets(fs, idb());
    expect(file.dispatchCount).toBeUndefined();
  });

  describe('v1 → v2 migration (plaintext token → encrypted)', () => {
    it('reads a v1 plaintext-token file and flags it for re-persist', async () => {
      const fs = new MemFs();
      await fs.writeFile(
        '.mi-cerebro/secrets.json',
        new TextEncoder().encode(
          JSON.stringify({
            schemaVersion: 1,
            remote: { url: 'https://github.com/owner/repo.git', token: 'ghp_legacy' },
          }),
        ),
      );
      const { file, migrated } = await readRemoteSecrets(fs, idb());
      expect(file.remote).toEqual({
        url: 'https://github.com/owner/repo.git',
        token: 'ghp_legacy',
      });
      expect(file.schemaVersion).toBe(REMOTE_SECRETS_SCHEMA_VERSION);
      expect(migrated).toBe(true);
    });

    it('re-persisting a migrated file encrypts it, and it still round-trips', async () => {
      const fs = new MemFs();
      const store = idb();
      await fs.writeFile(
        '.mi-cerebro/secrets.json',
        new TextEncoder().encode(
          JSON.stringify({
            schemaVersion: 1,
            remote: { url: 'https://github.com/owner/repo.git', token: 'ghp_legacy' },
          }),
        ),
      );
      const first = await readRemoteSecrets(fs, store);
      await writeRemoteSecrets(fs, store, first.file);
      expect(fs.text('.mi-cerebro/secrets.json')).not.toContain('ghp_legacy');
      const second = await readRemoteSecrets(fs, store);
      expect(second.file.remote?.token).toBe('ghp_legacy');
      expect(second.migrated).toBe(false);
    });
  });

  it('a token encrypted under one device key cannot be decrypted after the key is lost', async () => {
    const fs = new MemFs();
    const storeA = idb();
    await writeRemoteSecrets(fs, storeA, {
      schemaVersion: REMOTE_SECRETS_SCHEMA_VERSION,
      remote: { url: 'https://github.com/owner/repo.git', token: 'ghp_abc' },
    });
    await storeA.clear('crypto-keys');
    const { file } = await readRemoteSecrets(fs, storeA);
    expect(file.remote).toBeNull();
  });
});

describe('localDateKey', () => {
  it('formats as local YYYY-MM-DD, zero-padded', () => {
    expect(localDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(localDateKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('ensureGitignoredSecrets', () => {
  it('creates .gitignore with the secrets line if missing', async () => {
    const fs = new MemFs();
    await ensureGitignoredSecrets(fs);
    expect(fs.text('.gitignore')).toContain('/.mi-cerebro/secrets.json');
  });

  it('appends the line preserving previous content', async () => {
    const fs = new MemFs();
    await fs.writeFile('.gitignore', new TextEncoder().encode('node_modules\nbuild/\n'));
    await ensureGitignoredSecrets(fs);
    const text = fs.text('.gitignore');
    expect(text).toContain('node_modules');
    expect(text).toContain('/.mi-cerebro/secrets.json');
  });

  it('is idempotent — second call does not duplicate', async () => {
    const fs = new MemFs();
    await ensureGitignoredSecrets(fs);
    await ensureGitignoredSecrets(fs);
    const lines = fs
      .text('.gitignore')
      .split('\n')
      .filter((l) => l.includes('secrets.json'));
    expect(lines).toHaveLength(1);
  });

  it('recognizes the line without leading slash', async () => {
    const fs = new MemFs();
    await fs.writeFile('.gitignore', new TextEncoder().encode('.mi-cerebro/secrets.json\n'));
    await ensureGitignoredSecrets(fs);
    const lines = fs
      .text('.gitignore')
      .split('\n')
      .filter((l) => l.includes('secrets.json'));
    expect(lines).toHaveLength(1);
  });
});
