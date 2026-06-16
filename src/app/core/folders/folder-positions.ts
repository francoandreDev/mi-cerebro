import type { FsService } from '@core/fs/fs.service';
import type { FsDirectoryHandle } from '@core/fs/fs.types';
import { nextPositionAfter, seedMissingPositions } from '@core/ordering/seed-positions';

export const FOLDER_POSITIONS_FILE = '_folders.json';
export const FOLDER_POSITIONS_SCHEMA_VERSION = 1;

export interface FolderPositionsFile {
  readonly schemaVersion: number;
  readonly positions: Readonly<Record<string, string>>;
}

const empty = (): FolderPositionsFile => ({
  schemaVersion: FOLDER_POSITIONS_SCHEMA_VERSION,
  positions: {},
});

export const readFolderPositions = async (
  fs: FsService,
  kindRoot: FsDirectoryHandle,
): Promise<FolderPositionsFile> => {
  if (!(await fs.hasEntry(kindRoot, FOLDER_POSITIONS_FILE))) return empty();
  try {
    const raw = await fs.readJson<FolderPositionsFile>(kindRoot, FOLDER_POSITIONS_FILE);
    if (!raw || typeof raw !== 'object') return empty();
    return {
      schemaVersion: raw.schemaVersion ?? FOLDER_POSITIONS_SCHEMA_VERSION,
      positions: raw.positions && typeof raw.positions === 'object' ? raw.positions : {},
    };
  } catch {
    return empty();
  }
};

export const writeFolderPositions = async (
  fs: FsService,
  kindRoot: FsDirectoryHandle,
  positions: Readonly<Record<string, string>>,
): Promise<void> => {
  const payload: FolderPositionsFile = {
    schemaVersion: FOLDER_POSITIONS_SCHEMA_VERSION,
    positions,
  };
  await fs.writeFileAtomic(kindRoot, FOLDER_POSITIONS_FILE, JSON.stringify(payload, null, 2));
};

// why: same fractional-indexing semantics as entities — folders sharing a
//      parent must end up with strictly ordered positions. Seeding is done
//      per-parent so independent subtrees stay independent and a new folder
//      under one parent doesn't shift siblings under another.
export const seedFolderPositions = (
  current: Readonly<Record<string, string>>,
  pathsOrderedByLegacy: readonly string[],
): Readonly<Record<string, string>> => {
  if (pathsOrderedByLegacy.length === 0) return current;
  const byParent = new Map<string, { id: string; position: string }[]>();
  for (const path of pathsOrderedByLegacy) {
    const parent = parentOf(path);
    const list = byParent.get(parent) ?? [];
    list.push({ id: path, position: current[path] ?? '' });
    byParent.set(parent, list);
  }
  const out: Record<string, string> = { ...current };
  let added = false;
  for (const siblings of byParent.values()) {
    const seeds = seedMissingPositions(siblings);
    for (const s of seeds) {
      out[s.id] = s.position;
      added = true;
    }
  }
  return added ? out : current;
};

export const nextFolderPositionFor = (
  positions: Readonly<Record<string, string>>,
  parent: string,
): string => {
  let max: string | null = null;
  for (const [path, pos] of Object.entries(positions)) {
    if (parentOf(path) !== parent) continue;
    if (pos !== '' && (max === null || pos > max)) max = pos;
  }
  return nextPositionAfter(max);
};

export const renameFolderPositions = (
  positions: Readonly<Record<string, string>>,
  oldPath: string,
  newPath: string,
): Readonly<Record<string, string>> => {
  if (oldPath === newPath) return positions;
  const out: Record<string, string> = {};
  for (const [path, pos] of Object.entries(positions)) {
    if (path === oldPath) {
      out[newPath] = pos;
    } else if (path.startsWith(`${oldPath}/`)) {
      out[`${newPath}${path.slice(oldPath.length)}`] = pos;
    } else {
      out[path] = pos;
    }
  }
  return out;
};

export const deleteFolderPositions = (
  positions: Readonly<Record<string, string>>,
  prefix: string,
): Readonly<Record<string, string>> => {
  const out: Record<string, string> = {};
  for (const [path, pos] of Object.entries(positions)) {
    if (path === prefix || path.startsWith(`${prefix}/`)) continue;
    out[path] = pos;
  }
  return out;
};

const parentOf = (path: string): string => {
  const slash = path.lastIndexOf('/');
  return slash < 0 ? '' : path.slice(0, slash);
};
