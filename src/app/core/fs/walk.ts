import type { FsDirectoryHandle } from './fs.types';
import type { FsService } from './fs.service';

export interface FsEntityFile {
  readonly folder: string;
  readonly filename: string;
  readonly relativePath: string;
  readonly dirHandle: FsDirectoryHandle;
}

export interface FsFolder {
  readonly path: string;
  readonly parent: string;
  readonly name: string;
}

const join = (folder: string, name: string): string => (folder === '' ? name : `${folder}/${name}`);

export async function* walkEntities(
  fs: FsService,
  root: FsDirectoryHandle,
  suffix: string,
): AsyncIterable<FsEntityFile> {
  yield* walkInner(fs, root, suffix, '');
}

// why: meta sidecars live alongside entities (e.g. `_folders.json` at kind
//      root, `_book.json` inside a book dir). Skip them here so flat-file
//      entity services don't have to log+skip a malformed entity on every
//      refresh.
const META_FILES: ReadonlySet<string> = new Set([
  '_folders.json',
  '_book.json',
  '_gallery.json',
  '_collection.json',
]);

async function* walkInner(
  fs: FsService,
  dir: FsDirectoryHandle,
  suffix: string,
  folder: string,
): AsyncIterable<FsEntityFile> {
  for await (const filename of fs.listFiles(dir, suffix)) {
    if (META_FILES.has(filename)) continue;
    yield { folder, filename, relativePath: join(folder, filename), dirHandle: dir };
  }
  for await (const sub of fs.listSubdirs(dir)) {
    const subdir = await fs.getDir(dir, sub);
    if (!subdir) continue;
    yield* walkInner(fs, subdir, suffix, join(folder, sub));
  }
}

export async function listFolders(
  fs: FsService,
  root: FsDirectoryHandle,
): Promise<readonly FsFolder[]> {
  const out: FsFolder[] = [];
  await collectFolders(fs, root, '', out);
  return out;
}

async function collectFolders(
  fs: FsService,
  dir: FsDirectoryHandle,
  parent: string,
  out: FsFolder[],
): Promise<void> {
  for await (const name of fs.listSubdirs(dir)) {
    const path = join(parent, name);
    out.push({ path, parent, name });
    const sub = await fs.getDir(dir, name);
    if (sub) await collectFolders(fs, sub, path, out);
  }
}

export async function getOrCreateDirByPath(
  fs: FsService,
  root: FsDirectoryHandle,
  path: string,
): Promise<FsDirectoryHandle> {
  if (path === '') return root;
  let cursor = root;
  for (const part of path.split('/')) {
    cursor = await fs.getOrCreateDir(cursor, part);
  }
  return cursor;
}

export async function getDirByPath(
  fs: FsService,
  root: FsDirectoryHandle,
  path: string,
): Promise<FsDirectoryHandle | null> {
  if (path === '') return root;
  let cursor: FsDirectoryHandle | null = root;
  for (const part of path.split('/')) {
    cursor = await fs.getDir(cursor, part);
    if (!cursor) return null;
  }
  return cursor;
}

export const splitRelativePath = (relativePath: string): { folder: string; filename: string } => {
  const slash = relativePath.lastIndexOf('/');
  if (slash < 0) return { folder: '', filename: relativePath };
  return { folder: relativePath.slice(0, slash), filename: relativePath.slice(slash + 1) };
};

export const joinPath = join;
