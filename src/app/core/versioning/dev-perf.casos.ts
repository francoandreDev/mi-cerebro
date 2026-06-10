// The 10 cases executed by DevPerfService. Each receives an isolated
// subdir under .mi-cerebro/perf/ so they don't interfere with each
// other or with the user's real workspace data.
//
// eslint-disable: this is dev-only diagnostic code. Throws here are
// case-failure signals consumed by the runner, not user-facing errors,
// so the AppError/MCB code requirement (rule 26) doesn't apply.
/* eslint-disable no-restricted-syntax */

import * as git from 'isomorphic-git';

import type { GitFsAdapter } from './git-fs.adapter';
import { DEFAULT_GIT_AUTHOR, DEFAULT_GITIGNORE } from './versioning.constants';

const AUTHOR = { ...DEFAULT_GIT_AUTHOR };

export interface Caso7Detail {
  readonly n: number;
  readonly ensureRepoMs: number;
  readonly commitAllMs: number;
  readonly logMs: number;
  readonly readBlobMs: number;
}

export async function initRepo(fs: GitFsAdapter, dir: string): Promise<void> {
  await fs.promises.mkdir(dir);
  await git.init({ fs, dir, defaultBranch: 'main' });
  await fs.promises.writeFile(`${dir}/.gitignore`, DEFAULT_GITIGNORE);
}

export async function commitAll(
  fs: GitFsAdapter,
  dir: string,
  message: string,
): Promise<string | null> {
  const matrix = await git.statusMatrix({ fs, dir });
  const dirty = matrix.filter(([, h, w, s]) => h !== w || h !== s);
  const staged: typeof dirty = [];
  for (const row of dirty) {
    if (!(await git.isIgnored({ fs, dir, filepath: row[0] }))) staged.push(row);
  }
  if (staged.length === 0) return null;
  for (const [filepath, , work] of staged) {
    if (work === 0) await git.remove({ fs, dir, filepath });
    else await git.add({ fs, dir, filepath });
  }
  return git.commit({ fs, dir, message, author: AUTHOR });
}

export async function caso1(fs: GitFsAdapter, dir: string): Promise<void> {
  await initRepo(fs, dir);
  await fs.promises.stat(`${dir}/.git/HEAD`);
  await fs.promises.stat(`${dir}/.gitignore`);
  const log = await git.log({ fs, dir }).catch(() => []);
  if (log.length !== 0) throw new Error(`log() returned ${log.length} entries, expected 0`);
}

export async function caso2(fs: GitFsAdapter, dir: string): Promise<void> {
  await initRepo(fs, dir);
  const custom = '# user-edited\nfoo\n';
  await fs.promises.writeFile(`${dir}/.gitignore`, custom);
  await fs.promises.stat(`${dir}/.git`);
  const text = (await fs.promises.readFile(`${dir}/.gitignore`, 'utf8')) as string;
  if (text !== custom) throw new Error('user .gitignore was overwritten');
}

export async function caso3(fs: GitFsAdapter, dir: string): Promise<void> {
  await initRepo(fs, dir);
  await fs.promises.writeFile(`${dir}/note.json`, '{"id":"n1","title":"hola"}');
  const oid = await commitAll(fs, dir, 'smoke 1');
  if (!oid || !/^[0-9a-f]{40}$/.test(oid)) throw new Error(`bad oid: ${oid}`);
  const log = await git.log({ fs, dir });
  if (log.length !== 1) throw new Error(`expected 1 commit, got ${log.length}`);
  if (log[0]!.oid !== oid) throw new Error('log oid mismatch');
}

export async function caso4(fs: GitFsAdapter, dir: string): Promise<void> {
  await initRepo(fs, dir);
  await fs.promises.writeFile(`${dir}/note.json`, '{}');
  await commitAll(fs, dir, 'initial');
  const before = (await git.log({ fs, dir })).length;
  const r = await commitAll(fs, dir, 'empty');
  if (r !== null) throw new Error(`expected null, got ${r}`);
  const after = (await git.log({ fs, dir })).length;
  if (after !== before) throw new Error(`phantom commit (${before} → ${after})`);
}

export async function caso5(fs: GitFsAdapter, dir: string): Promise<void> {
  await initRepo(fs, dir);
  await fs.promises.writeFile(`${dir}/a.txt`, 'A1');
  await fs.promises.writeFile(`${dir}/b.txt`, 'B1');
  await fs.promises.writeFile(`${dir}/c.txt`, 'C1');
  const oid1 = await commitAll(fs, dir, 'base');
  await fs.promises.writeFile(`${dir}/a.txt`, 'A2');
  await fs.promises.writeFile(`${dir}/d.txt`, 'D1');
  await fs.promises.unlink(`${dir}/c.txt`);
  const oid2 = await commitAll(fs, dir, 'mixed');
  if (!oid2) throw new Error('mixed commit returned null');
  const { blob: a } = await git.readBlob({ fs, dir, oid: oid2, filepath: 'a.txt' });
  if (new TextDecoder().decode(a) !== 'A2') throw new Error('a.txt did not update');
  const { blob: d } = await git.readBlob({ fs, dir, oid: oid2, filepath: 'd.txt' });
  if (new TextDecoder().decode(d) !== 'D1') throw new Error('d.txt missing');
  let removed = false;
  try {
    await git.readBlob({ fs, dir, oid: oid2, filepath: 'c.txt' });
  } catch {
    removed = true;
  }
  if (!removed) throw new Error('c.txt should have been removed');
  const { blob: cOld } = await git.readBlob({ fs, dir, oid: oid1!, filepath: 'c.txt' });
  if (new TextDecoder().decode(cOld) !== 'C1') throw new Error('c.txt history lost');
}

export async function caso6(fs: GitFsAdapter, dir: string): Promise<void> {
  await initRepo(fs, dir);
  await commitAll(fs, dir, 'baseline');
  await fs.promises.writeFile(`${dir}/music/tracks/song.mp3`, 'fakebin');
  await fs.promises.writeFile(`${dir}/.mi-cerebro/trash/x.json`, '{}');
  await fs.promises.writeFile(`${dir}/.mi-cerebro/recovery/y.json`, '{}');
  await fs.promises.writeFile(`${dir}/images/foo/original/big.jpg`, 'jpeg');
  const r = await commitAll(fs, dir, 'ignored');
  if (r !== null) throw new Error('ignored paths were committed');
  for (const p of [
    'music/tracks/song.mp3',
    '.mi-cerebro/trash/x.json',
    '.mi-cerebro/recovery/y.json',
    'images/foo/original/big.jpg',
  ]) {
    if (!(await git.isIgnored({ fs, dir, filepath: p }))) throw new Error(`${p} not ignored`);
  }
}

export async function caso7(fs: GitFsAdapter, dir: string, n: number): Promise<Caso7Detail> {
  const t0 = performance.now();
  await initRepo(fs, dir);
  const ensureRepoMs = performance.now() - t0;
  for (let i = 0; i < n; i++) {
    await fs.promises.writeFile(`${dir}/notes/note-${i}.json`, syntheticNote(i));
  }
  const t1 = performance.now();
  await commitAll(fs, dir, 'perf');
  const commitAllMs = performance.now() - t1;
  const t2 = performance.now();
  await git.log({ fs, dir, depth: 50 });
  const logMs = performance.now() - t2;
  const t3 = performance.now();
  const head = await git.resolveRef({ fs, dir, ref: 'HEAD' });
  await git.readBlob({ fs, dir, oid: head, filepath: `notes/note-${Math.floor(n / 2)}.json` });
  const readBlobMs = performance.now() - t3;
  return { n, ensureRepoMs, commitAllMs, logMs, readBlobMs };
}

export async function caso8(fs: GitFsAdapter, dir: string): Promise<void> {
  await initRepo(fs, dir);
  await fs.promises.writeFile(`${dir}/note.json`, 'v1');
  const oid1 = await commitAll(fs, dir, 'v1');
  await fs.promises.writeFile(`${dir}/note.json`, 'v2');
  const oid2 = await commitAll(fs, dir, 'v2');
  if (!oid1 || !oid2 || oid1 === oid2) throw new Error('commits did not advance');
  const { blob: old } = await git.readBlob({ fs, dir, oid: oid1, filepath: 'note.json' });
  if (new TextDecoder().decode(old) !== 'v1') throw new Error('historical blob wrong');
}

export async function caso9(fs: GitFsAdapter, fs2: GitFsAdapter, dir: string): Promise<void> {
  await initRepo(fs, dir);
  await fs.promises.writeFile(`${dir}/note.json`, 'persisted');
  const oid = await commitAll(fs, dir, 'persisted');
  const log = await git.log({ fs: fs2, dir });
  if (log.length !== 1 || log[0]!.oid !== oid) throw new Error('history did not persist');
}

export async function caso10(fs: GitFsAdapter, dir: string): Promise<void> {
  await initRepo(fs, dir);
  await fs.promises.writeFile(`${dir}/note.json`, 'a');
  const oid = await commitAll(fs, dir, 'first');
  await fs.promises.stat(`${dir}/.git`);
  const log = await git.log({ fs, dir });
  if (log.length !== 1 || log[0]!.oid !== oid) throw new Error('repo not detected');
}

function syntheticNote(i: number): string {
  const paragraphs = Array.from(
    { length: 8 },
    (_, k) => `Párrafo ${k} de la nota sintética ${i}. ` + 'x'.repeat(120),
  );
  return JSON.stringify({
    id: `synthetic-${i}`,
    title: `Nota sintética ${i}`,
    body: {
      type: 'doc',
      content: paragraphs.map((text) => ({
        type: 'paragraph',
        content: [{ type: 'text', text }],
      })),
    },
    createdAt: new Date(2026, 0, 1, 0, 0, i).toISOString(),
  });
}
