// 13e-i — config IO + URL validation tests. No DI; the in-memory fs
// stub matches the ConfigFs interface so we exercise the real code path.

import { describe, expect, it } from 'vitest';

import type { ConfigFs } from './remote.config.io';
import {
  ensureGitignoredSecrets,
  isValidRemoteUrl,
  readRemoteSecrets,
  writeRemoteSecrets,
} from './remote.config.io';
import { REMOTE_SECRETS_SCHEMA_VERSION } from './remote.types';

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

describe('readRemoteSecrets', () => {
  it('returns empty file when secrets.json is missing', async () => {
    const fs = new MemFs();
    const file = await readRemoteSecrets(fs);
    expect(file.remote).toBeNull();
    expect(file.schemaVersion).toBe(REMOTE_SECRETS_SCHEMA_VERSION);
  });

  it('round-trips a configured file', async () => {
    const fs = new MemFs();
    await writeRemoteSecrets(fs, {
      schemaVersion: REMOTE_SECRETS_SCHEMA_VERSION,
      remote: { url: 'https://github.com/owner/repo.git', token: 'ghp_abc' },
    });
    const file = await readRemoteSecrets(fs);
    expect(file.remote).toEqual({ url: 'https://github.com/owner/repo.git', token: 'ghp_abc' });
  });

  it('discards files with future schemaVersion', async () => {
    const fs = new MemFs();
    await fs.writeFile(
      '.mi-cerebro/secrets.json',
      new TextEncoder().encode(
        JSON.stringify({ schemaVersion: 999, remote: { url: 'x', token: 'y' } }),
      ),
    );
    expect((await readRemoteSecrets(fs)).remote).toBeNull();
  });

  it('discards malformed remote payloads', async () => {
    const fs = new MemFs();
    await fs.writeFile(
      '.mi-cerebro/secrets.json',
      new TextEncoder().encode(JSON.stringify({ schemaVersion: 1, remote: { url: 'x' } })),
    );
    expect((await readRemoteSecrets(fs)).remote).toBeNull();
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
