import { Injectable, computed, inject, signal } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { ErrorService } from '@core/errors/error.service';
import { FsService } from '@core/fs/fs.service';
import type { NativeDirRef } from '@core/fs/native-fs.types';
import { getDirByPath, getOrCreateDirByPath, joinPath } from '@core/fs/walk';
import { WorkspaceService } from '@core/fs/workspace.service';
import { MigrationsService } from '@core/migrations/migrations.service';
import { nextPositionAfter, seedMissingPositions } from '@core/ordering/seed-positions';
import { positionSeedMigrationStep } from '@core/ordering/position.migration';
import { SearchIndexService } from '@core/search/search-index.service';
import type { SearchDoc } from '@core/search/search.types';
import { TagsService } from '@core/tags/tags.service';
import { toSlug, withSuffix } from '@shared/utils/slug';

import {
  COLLECTION_META_FILE,
  FILE_COLLECTION_SCHEMA_VERSION,
  FILE_KIND,
  FILES_DIR,
  ITEMS_DIR,
  extFromName,
  type FileCollection,
  type FileCollectionSummary,
  type FileItem,
} from '../models/file-collection.types';

const TRASH_DIR = '.mi-cerebro';
const TRASH_SUBDIR = 'trash';

interface CollectionLocation {
  readonly folder: string;
  readonly slug: string;
}

@Injectable({ providedIn: 'root' })
export class FilesService {
  private readonly fs = inject(FsService);
  private readonly workspace = inject(WorkspaceService);
  private readonly migrations = inject(MigrationsService);
  private readonly search = inject(SearchIndexService);
  private readonly tags = inject(TagsService);
  private readonly errors = inject(ErrorService);

  private readonly idToLoc = new Map<string, CollectionLocation>();
  private readonly summariesSignal = signal<readonly FileCollectionSummary[]>([]);
  readonly summaries = this.summariesSignal.asReadonly();
  private readonly foldersSignal = signal<readonly string[]>([]);
  readonly folders = this.foldersSignal.asReadonly();
  readonly foldersSet = computed(() => new Set(this.foldersSignal()));

  constructor() {
    this.migrations.register({
      kind: FILE_KIND,
      latest: FILE_COLLECTION_SCHEMA_VERSION,
      steps: [positionSeedMigrationStep(1)],
    });
  }

  async refresh(): Promise<readonly FileCollectionSummary[]> {
    const root = await this.filesDir();
    this.idToLoc.clear();
    const summaries: FileCollectionSummary[] = [];
    const folders: string[] = [];
    const indexDocs: SearchDoc[] = [];
    const collectionsById = new Map<string, FileCollection>();
    const skipped = { count: 0 };
    await this.walkCollections(root, '', summaries, folders, indexDocs, collectionsById, skipped);
    this.errors.reportSkippedEntries(skipped.count, { area: 'files' });
    summaries.sort(compareLegacy);
    const seeds = seedMissingPositions(summaries);
    if (seeds.length > 0) {
      const positionById = new Map(seeds.map((s) => [s.id, s.position] as const));
      for (const [id, pos] of positionById) {
        const collection = collectionsById.get(id);
        if (collection) await this.writePositionInPlace(collection, pos);
      }
      for (let i = 0; i < summaries.length; i++) {
        const seeded = positionById.get(summaries[i]!.id);
        if (seeded) summaries[i] = { ...summaries[i]!, position: seeded };
      }
    }
    summaries.sort(comparePosition);
    this.summariesSignal.set(summaries);
    this.foldersSignal.set(folders);
    for (const doc of indexDocs) await this.search.upsert(doc);
    return summaries;
  }

  async createCollection(title = '', folder = ''): Promise<FileCollection> {
    const root = await this.filesDir();
    const parent = await getOrCreateDirByPath(this.fs, root, folder);
    const slug = await this.allocSlug(parent, title);
    const collectionDir = await this.fs.getOrCreateDir(parent, slug);
    await this.fs.getOrCreateDir(collectionDir, ITEMS_DIR);
    const now = new Date().toISOString();
    const position = nextPositionAfter(lastPosition(this.summariesSignal()));
    const collection: FileCollection = {
      id: crypto.randomUUID(),
      title,
      tags: [],
      order: [],
      items: [],
      createdAt: now,
      updatedAt: now,
      schemaVersion: FILE_COLLECTION_SCHEMA_VERSION,
      position,
    };
    await this.fs.writeFileAtomic(
      collectionDir,
      COLLECTION_META_FILE,
      JSON.stringify(collection, null, 2),
    );
    this.idToLoc.set(collection.id, { folder, slug });
    this.summariesSignal.update((curr) =>
      sortByPosition([...curr, this.toSummary(collection, folder)]),
    );
    if (folder !== '' && !this.foldersSet().has(folder)) {
      this.foldersSignal.update((curr) => [...curr, folder]);
    }
    await this.search.upsert(this.toSearchDoc(collection));
    return collection;
  }

  async readCollection(id: string): Promise<FileCollection> {
    const dir = await this.collectionDir(id);
    const raw = await this.fs.readJson<FileCollection>(dir, COLLECTION_META_FILE);
    return this.migrations.migrate<FileCollection>(FILE_KIND, raw);
  }

  async saveCollection(collection: FileCollection): Promise<FileCollection> {
    const dir = await this.collectionDir(collection.id);
    const cleanTags = this.dropStaleTags(collection.tags);
    const updated: FileCollection = {
      ...collection,
      tags: cleanTags,
      updatedAt: new Date().toISOString(),
    };
    await this.fs.writeFileAtomic(dir, COLLECTION_META_FILE, JSON.stringify(updated, null, 2));
    const loc = this.idToLoc.get(collection.id);
    if (loc) {
      this.summariesSignal.update((curr) =>
        sortByPosition(
          curr.map((s) => (s.id === collection.id ? this.toSummary(updated, loc.folder) : s)),
        ),
      );
    }
    await this.search.upsert(this.toSearchDoc(updated));
    return updated;
  }

  async setPosition(id: string, position: string): Promise<void> {
    const collection = await this.readCollection(id);
    const updated: FileCollection = {
      ...collection,
      position,
      updatedAt: new Date().toISOString(),
    };
    const dir = await this.collectionDir(id);
    await this.fs.writeFileAtomic(dir, COLLECTION_META_FILE, JSON.stringify(updated, null, 2));
    this.summariesSignal.update((curr) =>
      sortByPosition(curr.map((s) => (s.id === id ? { ...s, position } : s))),
    );
  }

  private async writePositionInPlace(collection: FileCollection, position: string): Promise<void> {
    const dir = await this.collectionDir(collection.id);
    const seeded: FileCollection = { ...collection, position };
    await this.fs.writeFileAtomic(dir, COLLECTION_META_FILE, JSON.stringify(seeded, null, 2));
  }

  async addFile(collectionId: string, blob: Blob, originalName: string): Promise<FileItem> {
    const collection = await this.readCollection(collectionId);
    const dir = await this.collectionDir(collectionId);
    const mime = blob.type || 'application/octet-stream';
    const ext = extFromName(originalName);
    const id = crypto.randomUUID();
    const itemsDir = await this.fs.getOrCreateDir(dir, ITEMS_DIR);
    await this.fs.writeFileAtomicBinary(itemsDir, `${id}.${ext}`, blob);
    const item: FileItem = {
      id,
      originalName,
      mime,
      ext,
      bytes: blob.size,
      addedAt: new Date().toISOString(),
    };
    const updated: FileCollection = {
      ...collection,
      items: [...collection.items, item],
      order: [...collection.order, id],
    };
    await this.saveCollection(updated);
    return item;
  }

  async readBlob(collectionId: string, itemId: string): Promise<Blob> {
    const collection = await this.readCollection(collectionId);
    const meta = collection.items.find((i) => i.id === itemId);
    if (!meta) throw new AppError(ERROR_CODES.FS_003, { severity: 'error', context: { itemId } });
    const dir = await this.collectionDir(collectionId);
    const itemsDir = await this.fs.getOrCreateDir(dir, ITEMS_DIR);
    return this.fs.readFile(itemsDir, `${itemId}.${meta.ext}`);
  }

  async removeFile(collectionId: string, itemId: string): Promise<void> {
    const collection = await this.readCollection(collectionId);
    const meta = collection.items.find((i) => i.id === itemId);
    if (!meta) return;
    const dir = await this.collectionDir(collectionId);
    const itemsDir = await this.fs.getOrCreateDir(dir, ITEMS_DIR);
    try {
      await this.fs.removeEntry(itemsDir, `${itemId}.${meta.ext}`);
    } catch {
      /* already gone */
    }
    const updated: FileCollection = {
      ...collection,
      items: collection.items.filter((i) => i.id !== itemId),
      order: collection.order.filter((id) => id !== itemId),
    };
    await this.saveCollection(updated);
  }

  async reorderFiles(collectionId: string, order: readonly string[]): Promise<void> {
    const collection = await this.readCollection(collectionId);
    await this.saveCollection({ ...collection, order });
  }

  async renameFile(collectionId: string, itemId: string, name: string): Promise<void> {
    const collection = await this.readCollection(collectionId);
    const trimmed = name.trim();
    const items = collection.items.map((it) => {
      if (it.id !== itemId) return it;
      if (trimmed === '' || trimmed === it.originalName) {
        const next: FileItem = { ...it };
        delete (next as { displayName?: string }).displayName;
        return next;
      }
      return { ...it, displayName: trimmed };
    });
    await this.saveCollection({ ...collection, items });
  }

  async deleteCollectionToTrash(id: string): Promise<void> {
    const root = this.requireRoot();
    const loc = await this.findLoc(id);
    const parent = await this.getFolderDir(loc.folder);
    if (!parent) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    const srcDir = await this.fs.getDir(parent, loc.slug);
    if (!srcDir) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    const trash = await this.trashDir(root);
    const destName = `${FILE_KIND}__${id}__${loc.slug}`;
    const destDir = await this.fs.getOrCreateDir(trash, destName);
    await moveCollectionDir(this.fs, srcDir, destDir);
    try {
      await this.fs.removeEntry(parent, loc.slug, { recursive: true });
    } catch {
      /* already gone */
    }
    this.idToLoc.delete(id);
    this.summariesSignal.update((curr) => curr.filter((s) => s.id !== id));
    await this.search.remove(id);
  }

  async restoreFromDir(trashDayDir: NativeDirRef, entryName: string): Promise<void> {
    const srcDir = await this.fs.getDir(trashDayDir, entryName);
    if (!srcDir) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    const collection = await this.fs.readJson<FileCollection>(srcDir, COLLECTION_META_FILE);
    const root = await this.filesDir();
    const slug = await this.allocSlug(root, collection.title);
    const destDir = await this.fs.getOrCreateDir(root, slug);
    await moveCollectionDir(this.fs, srcDir, destDir);
    try {
      await this.fs.removeEntry(trashDayDir, entryName, { recursive: true });
    } catch {
      /* already gone */
    }
    await this.refresh();
  }

  async moveCollectionToFolder(id: string, newFolder: string): Promise<void> {
    const loc = await this.findLoc(id);
    if (loc.folder === newFolder) return;
    const root = await this.filesDir();
    const srcParent = await this.getFolderDir(loc.folder);
    if (!srcParent) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    const destParent = await getOrCreateDirByPath(this.fs, root, newFolder);
    const destSlug = await this.allocAvailableDir(destParent, loc.slug);
    const srcDir = await this.fs.getDir(srcParent, loc.slug);
    if (!srcDir) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    const destDir = await this.fs.getOrCreateDir(destParent, destSlug);
    await moveCollectionDir(this.fs, srcDir, destDir);
    try {
      await this.fs.removeEntry(srcParent, loc.slug, { recursive: true });
    } catch {
      /* already gone */
    }
    this.idToLoc.set(id, { folder: newFolder, slug: destSlug });
    this.summariesSignal.update((curr) =>
      sortByPosition(curr.map((s) => (s.id === id ? { ...s, folder: newFolder } : s))),
    );
    if (newFolder !== '' && !this.foldersSet().has(newFolder)) {
      this.foldersSignal.update((curr) => [...curr, newFolder]);
    }
  }

  private async walkCollections(
    dir: NativeDirRef,
    folder: string,
    summaries: FileCollectionSummary[],
    folders: string[],
    indexDocs: SearchDoc[],
    collectionsById: Map<string, FileCollection>,
    skipped: { count: number },
  ): Promise<void> {
    for await (const name of this.fs.listSubdirs(dir)) {
      const sub = await this.fs.getDir(dir, name);
      if (!sub) continue;
      if (await this.fs.hasEntry(sub, COLLECTION_META_FILE)) {
        try {
          const raw = await this.fs.readJson<FileCollection>(sub, COLLECTION_META_FILE);
          const collection = await this.migrations.migrate<FileCollection>(FILE_KIND, raw);
          this.idToLoc.set(collection.id, { folder, slug: name });
          collectionsById.set(collection.id, collection);
          summaries.push(this.toSummary(collection, folder));
          indexDocs.push(this.toSearchDoc(collection));
        } catch (cause) {
          skipped.count++;
          console.warn('[files] skipped collection', name, cause);
        }
      } else {
        const path = joinPath(folder, name);
        folders.push(path);
        await this.walkCollections(
          sub,
          path,
          summaries,
          folders,
          indexDocs,
          collectionsById,
          skipped,
        );
      }
    }
  }

  private requireRoot(): NativeDirRef {
    const root = this.workspace.root();
    if (!root) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    return root;
  }

  // why: reload directo puede montar la ruta de detalle antes de que el
  //      sidebar dispare refresh() y puebla idToLoc — re-caminamos el
  //      filesystem como fallback en vez de asumir el id borrado (§20a).
  private async findLoc(id: string): Promise<CollectionLocation> {
    const cached = this.idToLoc.get(id);
    if (cached) return cached;
    const root = await this.filesDir();
    const found = await this.walkForLoc(root, '', id);
    if (found) return found;
    throw new AppError(ERROR_CODES.FS_008, { severity: 'error', context: { id } });
  }

  private async walkForLoc(
    dir: NativeDirRef,
    folder: string,
    id: string,
  ): Promise<CollectionLocation | null> {
    for await (const name of this.fs.listSubdirs(dir)) {
      const sub = await this.fs.getDir(dir, name);
      if (!sub) continue;
      if (await this.fs.hasEntry(sub, COLLECTION_META_FILE)) {
        try {
          const raw = await this.fs.readJson<FileCollection>(sub, COLLECTION_META_FILE);
          this.idToLoc.set(raw.id, { folder, slug: name });
          if (raw.id === id) return { folder, slug: name };
        } catch {
          /* skip corrupt */
        }
      } else {
        const found = await this.walkForLoc(sub, joinPath(folder, name), id);
        if (found) return found;
      }
    }
    return null;
  }

  private async filesDir(): Promise<NativeDirRef> {
    return this.fs.getOrCreateDir(this.requireRoot(), FILES_DIR);
  }

  private async getFolderDir(folder: string): Promise<NativeDirRef | null> {
    const root = await this.filesDir();
    return getDirByPath(this.fs, root, folder);
  }

  private async collectionDir(id: string): Promise<NativeDirRef> {
    const loc = await this.findLoc(id);
    const parent = await this.getFolderDir(loc.folder);
    if (!parent) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    const dir = await this.fs.getDir(parent, loc.slug);
    if (!dir) throw new AppError(ERROR_CODES.FS_008, { severity: 'error', context: { id } });
    return dir;
  }

  private async trashDir(root: NativeDirRef): Promise<NativeDirRef> {
    const meta = await this.fs.getOrCreateDir(root, TRASH_DIR);
    const trash = await this.fs.getOrCreateDir(meta, TRASH_SUBDIR);
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
    let cursor = trash;
    for (const part of today.split('/')) {
      cursor = await this.fs.getOrCreateDir(cursor, part);
    }
    return cursor;
  }

  private async allocSlug(dir: NativeDirRef, title: string): Promise<string> {
    const base = toSlug(title, 'coleccion');
    for (let n = 1; n < 1000; n++) {
      const candidate = withSuffix(base, n);
      if (!(await this.fs.hasEntry(dir, candidate))) return candidate;
    }
    throw new AppError(ERROR_CODES.FS_001, { severity: 'error', context: { base } });
  }

  private async allocAvailableDir(dir: NativeDirRef, name: string): Promise<string> {
    if (!(await this.fs.hasEntry(dir, name))) return name;
    for (let n = 1; n < 1000; n++) {
      const candidate = `${name}-${n}`;
      if (!(await this.fs.hasEntry(dir, candidate))) return candidate;
    }
    throw new AppError(ERROR_CODES.FS_001, { severity: 'error' });
  }

  private toSummary(collection: FileCollection, folder: string): FileCollectionSummary {
    return {
      id: collection.id,
      title: collection.title,
      updatedAt: collection.updatedAt,
      tags: collection.tags,
      folder,
      itemCount: collection.items.length,
      position: collection.position ?? '',
    };
  }

  private toSearchDoc(collection: FileCollection): SearchDoc {
    const tagIds = this.dropStaleTags(collection.tags);
    const tagLabels = tagIds
      .map((id) => this.tags.byId(id)?.label ?? '')
      .filter((l) => l !== '')
      .join(' ');
    const itemNames = collection.items
      .flatMap((i) => (i.displayName ? [i.originalName, i.displayName] : [i.originalName]))
      .join(' ');
    return {
      id: collection.id,
      kind: FILE_KIND,
      title: collection.title,
      body: `${tagLabels} ${itemNames}`.trim(),
      tagIds,
    };
  }

  private dropStaleTags(tagIds: readonly string[]): readonly string[] {
    if (tagIds.length === 0) return tagIds;
    return tagIds.filter((id) => this.tags.byId(id) !== undefined);
  }
}

const compareLegacy = (a: FileCollectionSummary, b: FileCollectionSummary): number =>
  b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);

const comparePosition = (a: FileCollectionSummary, b: FileCollectionSummary): number => {
  if (a.position === '' && b.position === '') return compareLegacy(a, b);
  if (a.position === '') return 1;
  if (b.position === '') return -1;
  return a.position < b.position ? -1 : a.position > b.position ? 1 : 0;
};

const sortByPosition = (list: readonly FileCollectionSummary[]): FileCollectionSummary[] =>
  [...list].sort(comparePosition);

const lastPosition = (list: readonly FileCollectionSummary[]): string | null => {
  let max: string | null = null;
  for (const s of list) {
    if (s.position !== '' && (max === null || s.position > max)) max = s.position;
  }
  return max;
};

const moveCollectionDir = async (
  fs: FsService,
  src: NativeDirRef,
  dest: NativeDirRef,
): Promise<void> => {
  for await (const filename of fs.listFiles(src)) {
    await fs.moveFile(src, filename, dest, filename);
  }
  for await (const sub of fs.listSubdirs(src)) {
    const subSrc = await fs.getDir(src, sub);
    if (!subSrc) continue;
    const subDest = await fs.getOrCreateDir(dest, sub);
    await moveCollectionDir(fs, subSrc, subDest);
  }
};
