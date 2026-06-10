// Integration smoke: real isomorphic-git API calls against GitFsAdapter
// over an in-memory mock of FileSystemDirectoryHandle. Validates the
// adapter contract end-to-end. Does NOT validate real-disk performance
// (caso 7) — that requires a browser smoke against the user's workspace.

import * as git from 'isomorphic-git';
import { describe, expect, it } from 'vitest';

import type { FsDirectoryHandle } from '@core/fs/fs.types';

import { GitFsAdapter } from './git-fs.adapter';
import { DEFAULT_GITIGNORE } from './versioning.constants';

class NotFound extends DOMException {
  constructor() {
    super('not found', 'NotFoundError');
  }
}
class TypeMismatch extends DOMException {
  constructor() {
    super('type mismatch', 'TypeMismatchError');
  }
}
class InvalidMod extends DOMException {
  constructor() {
    super('not empty', 'InvalidModificationError');
  }
}

class MockFile {
  constructor(public data: Uint8Array) {}
  size = 0;
  lastModified = 1700000000000;
  async arrayBuffer(): Promise<ArrayBuffer> {
    return this.data.buffer.slice(
      this.data.byteOffset,
      this.data.byteOffset + this.data.byteLength,
    ) as ArrayBuffer;
  }
}

let mockClock = 1700000000000;

class MockWritable {
  constructor(private readonly target: MockFileHandle) {}
  async write(data: Uint8Array | string | Blob): Promise<void> {
    if (typeof data === 'string') {
      this.target.contents = new TextEncoder().encode(data);
    } else if (data instanceof Blob) {
      this.target.contents = new Uint8Array(await data.arrayBuffer());
    } else {
      this.target.contents = new Uint8Array(data);
    }
    // why: isomorphic-git's index records mtime at SECOND precision (git
    //      index format). Bumping by 1s per write guarantees two successive
    //      edits to the same path land in different seconds, so git.add
    //      re-hashes instead of trusting the cached index entry.
    mockClock += 1000;
    this.target.lastModified = mockClock;
  }
  async close(): Promise<void> {
    // mock no-op
  }
}

class MockFileHandle {
  kind = 'file' as const;
  contents = new Uint8Array();
  lastModified = mockClock;
  constructor(public readonly name: string) {}
  async getFile(): Promise<MockFile> {
    const f = new MockFile(this.contents);
    f.size = this.contents.byteLength;
    f.lastModified = this.lastModified;
    return f;
  }
  async createWritable(_o?: unknown): Promise<MockWritable> {
    return new MockWritable(this);
  }
}

class MockDirHandle {
  kind = 'dir' as const;
  readonly entries = new Map<string, MockDirHandle | MockFileHandle>();
  constructor(public readonly name = '/') {}

  async getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<MockDirHandle> {
    const e = this.entries.get(name);
    if (e && e.kind === 'dir') return e;
    if (e && e.kind === 'file') throw new TypeMismatch();
    if (opts?.create) {
      const created = new MockDirHandle(name);
      this.entries.set(name, created);
      return created;
    }
    throw new NotFound();
  }

  async getFileHandle(name: string, opts?: { create?: boolean }): Promise<MockFileHandle> {
    const e = this.entries.get(name);
    if (e && e.kind === 'file') return e;
    if (e && e.kind === 'dir') throw new TypeMismatch();
    if (opts?.create) {
      const created = new MockFileHandle(name);
      this.entries.set(name, created);
      return created;
    }
    throw new NotFound();
  }

  async removeEntry(name: string, opts?: { recursive?: boolean }): Promise<void> {
    const e = this.entries.get(name);
    if (!e) throw new NotFound();
    if (e.kind === 'dir' && !opts?.recursive && e.entries.size > 0) {
      throw new InvalidMod();
    }
    this.entries.delete(name);
  }

  async *keys(): AsyncIterable<string> {
    for (const k of this.entries.keys()) yield k;
  }
}

function makeRoot(): { root: FsDirectoryHandle; mock: MockDirHandle } {
  const mock = new MockDirHandle();
  return { root: mock as unknown as FsDirectoryHandle, mock };
}

const AUTHOR = { name: 'test', email: 'test@local' };
const DIR = '/';

async function writeFile(fs: GitFsAdapter, path: string, content: string): Promise<void> {
  await fs.promises.writeFile(path, content);
}

async function init(fs: GitFsAdapter): Promise<void> {
  await git.init({ fs, dir: DIR, defaultBranch: 'main' });
  await fs.promises.writeFile('/.gitignore', DEFAULT_GITIGNORE);
}

async function commitAll(fs: GitFsAdapter, message: string): Promise<string | null> {
  const matrix = await git.statusMatrix({ fs, dir: DIR });
  const dirty = matrix.filter(([, h, w, s]) => h !== w || h !== s);
  const staged: typeof dirty = [];
  for (const row of dirty) {
    const filepath = row[0];
    const ignored = await git.isIgnored({ fs, dir: DIR, filepath });
    if (!ignored) staged.push(row);
  }
  if (staged.length === 0) return null;
  for (const [filepath, , work] of staged) {
    if (work === 0) await git.remove({ fs, dir: DIR, filepath });
    else await git.add({ fs, dir: DIR, filepath });
  }
  return git.commit({ fs, dir: DIR, message, author: AUTHOR });
}

describe('GitFsAdapter ↔ isomorphic-git integration', () => {
  it('caso 1: init en repo fresco crea .git/ y .gitignore', async () => {
    const { root, mock } = makeRoot();
    const fs = new GitFsAdapter(root);
    await init(fs);
    expect(mock.entries.has('.git')).toBe(true);
    const dotGit = mock.entries.get('.git') as MockDirHandle;
    expect(dotGit.entries.has('HEAD')).toBe(true);
    expect(dotGit.entries.has('objects')).toBe(true);
    expect(dotGit.entries.has('refs')).toBe(true);
    expect(mock.entries.has('.gitignore')).toBe(true);
    const log = await git.log({ fs, dir: DIR }).catch(() => []);
    expect(log).toEqual([]);
  });

  it('caso 2: init es idempotente — segunda corrida no rompe', async () => {
    const { root, mock } = makeRoot();
    const fs = new GitFsAdapter(root);
    await init(fs);
    const customIgnore = '# user-edited\nfoo\n';
    await fs.promises.writeFile('/.gitignore', customIgnore);
    // simula la lógica del service: si .git existe, skip init y skip .gitignore
    let alreadyInit = false;
    try {
      await fs.promises.stat('/.git');
      alreadyInit = true;
    } catch {
      // no-op
    }
    expect(alreadyInit).toBe(true);
    const ignore = (await fs.promises.readFile('/.gitignore', 'utf8')) as string;
    expect(ignore).toBe(customIgnore);
    void mock;
  });

  it('caso 3: primer commit devuelve oid de 40 chars y log() lo encuentra', async () => {
    const { root } = makeRoot();
    const fs = new GitFsAdapter(root);
    await init(fs);
    await writeFile(fs, '/notes/n1.json', '{"id":"n1","title":"hola"}');
    const oid = await commitAll(fs, 'smoke 1');
    expect(oid).toMatch(/^[0-9a-f]{40}$/);
    const log = await git.log({ fs, dir: DIR });
    expect(log).toHaveLength(1);
    expect(log[0]!.oid).toBe(oid);
    expect(log[0]!.commit.message).toBe('smoke 1\n');
    expect(log[0]!.commit.parent).toEqual([]);
  });

  it('caso 4: commitAll sin cambios devuelve null y no genera commit fantasma', async () => {
    const { root } = makeRoot();
    const fs = new GitFsAdapter(root);
    await init(fs);
    await writeFile(fs, '/notes/n1.json', '{"id":"n1"}');
    await commitAll(fs, 'inicial');
    const before = await git.log({ fs, dir: DIR });
    const result = await commitAll(fs, 'vacío');
    expect(result).toBeNull();
    const after = await git.log({ fs, dir: DIR });
    expect(after.length).toBe(before.length);
  });

  it('caso 5: add + modify + delete en un commit', async () => {
    const { root } = makeRoot();
    const fs = new GitFsAdapter(root);
    await init(fs);
    await writeFile(fs, '/a.txt', 'A1');
    await writeFile(fs, '/b.txt', 'B1');
    await writeFile(fs, '/c.txt', 'C1');
    const oid1 = await commitAll(fs, 'base');
    expect(oid1).not.toBeNull();
    await writeFile(fs, '/a.txt', 'A2');
    await fs.promises.writeFile('/d.txt', 'D1');
    await fs.promises.unlink('/c.txt');
    const oid2 = await commitAll(fs, 'mixed');
    expect(oid2).not.toBeNull();
    const { blob: aBlob } = await git.readBlob({
      fs,
      dir: DIR,
      oid: oid2!,
      filepath: 'a.txt',
    });
    expect(new TextDecoder().decode(aBlob)).toBe('A2');
    const { blob: dBlob } = await git.readBlob({
      fs,
      dir: DIR,
      oid: oid2!,
      filepath: 'd.txt',
    });
    expect(new TextDecoder().decode(dBlob)).toBe('D1');
    await expect(
      git.readBlob({ fs, dir: DIR, oid: oid2!, filepath: 'c.txt' }),
    ).rejects.toBeDefined();
    const { blob: cInOld } = await git.readBlob({
      fs,
      dir: DIR,
      oid: oid1!,
      filepath: 'c.txt',
    });
    expect(new TextDecoder().decode(cInOld)).toBe('C1');
  });

  it('caso 6: .gitignore filtra binarios y safety nets', async () => {
    const { root } = makeRoot();
    const fs = new GitFsAdapter(root);
    await init(fs);
    // baseline: commit .gitignore so it's no longer dirty
    await commitAll(fs, 'baseline');
    await writeFile(fs, '/music/tracks/song.mp3', 'fakebinary');
    await writeFile(fs, '/.mi-cerebro/trash/x.json', '{}');
    await writeFile(fs, '/.mi-cerebro/recovery/y.json', '{}');
    await writeFile(fs, '/images/foo/original/big.jpg', 'jpeg');
    const result = await commitAll(fs, 'ignored');
    expect(result).toBeNull();
    for (const ignored of [
      'music/tracks/song.mp3',
      '.mi-cerebro/trash/x.json',
      '.mi-cerebro/recovery/y.json',
      'images/foo/original/big.jpg',
    ]) {
      expect(await git.isIgnored({ fs, dir: DIR, filepath: ignored })).toBe(true);
    }
  });

  it('caso 8: readBlob de un commit pasado devuelve el contenido viejo', async () => {
    const { root } = makeRoot();
    const fs = new GitFsAdapter(root);
    await init(fs);
    await writeFile(fs, '/note.json', 'v1');
    const oid1 = await commitAll(fs, 'v1');
    await writeFile(fs, '/note.json', 'v2');
    const oid2 = await commitAll(fs, 'v2');
    expect(oid1).not.toBe(oid2);
    const { blob: old } = await git.readBlob({
      fs,
      dir: DIR,
      oid: oid1!,
      filepath: 'note.json',
    });
    expect(new TextDecoder().decode(old)).toBe('v1');
    const { blob: cur } = await git.readBlob({
      fs,
      dir: DIR,
      oid: oid2!,
      filepath: 'note.json',
    });
    expect(new TextDecoder().decode(cur)).toBe('v2');
  });

  it('caso 9 (light): re-instanciar el adapter sobre el mismo dir lee el historial', async () => {
    const { root } = makeRoot();
    const fs1 = new GitFsAdapter(root);
    await init(fs1);
    await writeFile(fs1, '/note.json', 'persisted');
    const oid = await commitAll(fs1, 'persisted');
    expect(oid).not.toBeNull();
    // simula recarga: nueva instancia del adapter contra el mismo handle
    const fs2 = new GitFsAdapter(root);
    const log = await git.log({ fs: fs2, dir: DIR });
    expect(log).toHaveLength(1);
    expect(log[0]!.oid).toBe(oid);
  });

  it('caso 10: ensureRepo detecta .git/ preexistente y no reinicializa', async () => {
    const { root } = makeRoot();
    const fs = new GitFsAdapter(root);
    await init(fs);
    await writeFile(fs, '/note.json', 'a');
    const firstOid = await commitAll(fs, 'first');
    // segunda apertura del workspace: lógica del service
    let existed = false;
    try {
      await fs.promises.stat('/.git');
      existed = true;
    } catch {
      // no-op
    }
    expect(existed).toBe(true);
    const log = await git.log({ fs, dir: DIR });
    expect(log).toHaveLength(1);
    expect(log[0]!.oid).toBe(firstOid);
  });
});
