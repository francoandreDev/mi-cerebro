import { Injectable, computed, inject, signal } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { FsService } from '@core/fs/fs.service';
import type { FsDirectoryHandle } from '@core/fs/fs.types';
import {
  getDirByPath,
  getOrCreateDirByPath,
  joinPath,
  listFolders,
  splitRelativePath,
  walkEntities,
} from '@core/fs/walk';
import { WorkspaceService } from '@core/fs/workspace.service';
import { MigrationsService } from '@core/migrations/migrations.service';
import { nextPositionAfter, seedMissingPositions } from '@core/ordering/seed-positions';
import { positionSeedMigrationStep } from '@core/ordering/position.migration';
import { SearchIndexService } from '@core/search/search-index.service';
import { blockIdMigrationStep } from '@core/tiptap/block-id/block-id.migration';
import type { SearchDoc } from '@core/search/search.types';
import { extractPlainText } from '@core/search/tiptap-text';
import { TagsService } from '@core/tags/tags.service';
import { toSlug, withSuffix } from '@shared/utils/slug';

import {
  NOTE_FILE_SUFFIX,
  NOTE_KIND,
  NOTE_SCHEMA_VERSION,
  NOTES_DIR,
  emptyDoc,
  type Note,
  type NoteSummary,
} from '../models/note.types';

const TRASH_DIR = '.mi-cerebro';
const TRASH_SUBDIR = 'trash';

@Injectable({ providedIn: 'root' })
export class NotesService {
  private readonly fs = inject(FsService);
  private readonly workspace = inject(WorkspaceService);
  private readonly migrations = inject(MigrationsService);
  private readonly search = inject(SearchIndexService);
  private readonly tags = inject(TagsService);

  // why: caches relative path like 'inbox/idea.json' so save/read/delete
  //      reach the right subdirectory without re-walking the tree.
  private readonly idToPath = new Map<string, string>();
  private readonly summariesSignal = signal<readonly NoteSummary[]>([]);
  readonly summaries = this.summariesSignal.asReadonly();
  private readonly foldersSignal = signal<readonly string[]>([]);
  readonly folders = this.foldersSignal.asReadonly();

  readonly foldersSet = computed(() => new Set(this.foldersSignal()));

  constructor() {
    this.migrations.register({
      kind: NOTE_KIND,
      latest: NOTE_SCHEMA_VERSION,
      steps: [blockIdMigrationStep(1), positionSeedMigrationStep(2)],
    });
  }

  async refresh(): Promise<readonly NoteSummary[]> {
    const dir = await this.notesDir();
    this.idToPath.clear();
    const summaries: NoteSummary[] = [];
    const indexDocs: SearchDoc[] = [];
    const notesById = new Map<string, Note>();
    for await (const entry of walkEntities(this.fs, dir, NOTE_FILE_SUFFIX)) {
      try {
        const raw = await this.fs.readJson<Note>(entry.dirHandle, entry.filename);
        const note = await this.migrations.migrate<Note>(NOTE_KIND, raw);
        this.idToPath.set(note.id, entry.relativePath);
        notesById.set(note.id, note);
        summaries.push(this.toSummary(note, entry.folder));
        indexDocs.push(this.toSearchDoc(note));
      } catch (cause) {
        console.warn('[notes] skipped unreadable file', entry.relativePath, cause);
      }
    }
    summaries.sort(compareLegacy);
    const seeds = seedMissingPositions(summaries);
    if (seeds.length > 0) {
      const positionById = new Map(seeds.map((s) => [s.id, s.position] as const));
      for (const [id, pos] of positionById) {
        const note = notesById.get(id);
        if (note) await this.writePositionInPlace(note, pos);
      }
      for (let i = 0; i < summaries.length; i++) {
        const seeded = positionById.get(summaries[i]!.id);
        if (seeded) summaries[i] = { ...summaries[i]!, position: seeded };
      }
    }
    summaries.sort(comparePosition);
    this.summariesSignal.set(summaries);
    const folders = await listFolders(this.fs, dir);
    this.foldersSignal.set(folders.map((f) => f.path));
    await this.search.rebuild(indexDocs);
    return summaries;
  }

  async create(title = '', folder = ''): Promise<Note> {
    const root = await this.notesDir();
    const targetDir = await getOrCreateDirByPath(this.fs, root, folder);
    const now = new Date().toISOString();
    const position = nextPositionAfter(lastPosition(this.summariesSignal()));
    const note: Note = {
      id: crypto.randomUUID(),
      title,
      body: emptyDoc(),
      tags: [],
      createdAt: now,
      updatedAt: now,
      schemaVersion: NOTE_SCHEMA_VERSION,
      position,
    };
    const filename = await this.allocFilename(targetDir, title);
    await this.fs.writeFileAtomic(targetDir, filename, JSON.stringify(note, null, 2));
    const relativePath = joinPath(folder, filename);
    this.idToPath.set(note.id, relativePath);
    this.summariesSignal.update((list) => sortByPosition([...list, this.toSummary(note, folder)]));
    if (folder !== '' && !this.foldersSet().has(folder)) {
      this.foldersSignal.update((list) => [...list, folder]);
    }
    await this.search.upsert(this.toSearchDoc(note));
    return note;
  }

  async read(id: string): Promise<Note> {
    const dir = await this.notesDir();
    const { folder, filename } = splitRelativePath(await this.findPath(dir, id));
    const subdir = await getDirByPath(this.fs, dir, folder);
    if (!subdir) throw new AppError(ERROR_CODES.FS_003, { severity: 'error', context: { id } });
    const raw = await this.fs.readJson<Note>(subdir, filename);
    return this.migrations.migrate<Note>(NOTE_KIND, raw);
  }

  async save(note: Note): Promise<Note> {
    const dir = await this.notesDir();
    const cleanTags = this.dropStaleTags(note.tags);
    const updated: Note = { ...note, tags: cleanTags, updatedAt: new Date().toISOString() };
    const { folder, filename } = splitRelativePath(await this.findPath(dir, note.id));
    const subdir = await getDirByPath(this.fs, dir, folder);
    if (!subdir) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    await this.fs.writeFileAtomic(subdir, filename, JSON.stringify(updated, null, 2));
    this.summariesSignal.update((list) =>
      list.map((s) => (s.id === note.id ? this.toSummary(updated, folder) : s)),
    );
    await this.search.upsert(this.toSearchDoc(updated));
    return updated;
  }

  async setPosition(id: string, position: string): Promise<void> {
    const note = await this.read(id);
    const updated: Note = { ...note, position, updatedAt: new Date().toISOString() };
    const dir = await this.notesDir();
    const { folder, filename } = splitRelativePath(await this.findPath(dir, id));
    const subdir = await getDirByPath(this.fs, dir, folder);
    if (!subdir) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    await this.fs.writeFileAtomic(subdir, filename, JSON.stringify(updated, null, 2));
    this.summariesSignal.update((list) =>
      sortByPosition(list.map((s) => (s.id === id ? { ...s, position } : s))),
    );
  }

  private async writePositionInPlace(note: Note, position: string): Promise<void> {
    const dir = await this.notesDir();
    const { folder, filename } = splitRelativePath(await this.findPath(dir, note.id));
    const subdir = await getDirByPath(this.fs, dir, folder);
    if (!subdir) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    const seeded: Note = { ...note, position };
    await this.fs.writeFileAtomic(subdir, filename, JSON.stringify(seeded, null, 2));
  }

  async deleteToTrash(id: string): Promise<void> {
    const root = this.requireRoot();
    const dir = await this.notesDir();
    const { folder, filename } = splitRelativePath(await this.findPath(dir, id));
    const subdir = await getDirByPath(this.fs, dir, folder);
    if (!subdir) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    const trashDir = await this.trashDir(root);
    const dest = `${NOTE_KIND}__${id}__${filename}`;
    await this.fs.moveFile(subdir, filename, trashDir, dest);
    this.idToPath.delete(id);
    this.summariesSignal.update((list) => list.filter((s) => s.id !== id));
    await this.search.remove(id);
  }

  async moveToFolder(id: string, newFolder: string): Promise<void> {
    const dir = await this.notesDir();
    const currentPath = await this.findPath(dir, id);
    const { folder: oldFolder, filename } = splitRelativePath(currentPath);
    if (oldFolder === newFolder) return;
    const src = await getDirByPath(this.fs, dir, oldFolder);
    if (!src) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    const dest = await getOrCreateDirByPath(this.fs, dir, newFolder);
    const destName = await this.allocAvailable(dest, filename);
    await this.fs.moveFile(src, filename, dest, destName);
    this.idToPath.set(id, joinPath(newFolder, destName));
    this.summariesSignal.update((list) =>
      list.map((s) => (s.id === id ? { ...s, folder: newFolder } : s)),
    );
    if (newFolder !== '' && !this.foldersSet().has(newFolder)) {
      this.foldersSignal.update((list) => [...list, newFolder]);
    }
  }

  setKnownPath(id: string, relativePath: string): void {
    this.idToPath.set(id, relativePath);
  }

  private requireRoot(): FsDirectoryHandle {
    const root = this.workspace.root();
    if (!root) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    return root;
  }

  private async notesDir(): Promise<FsDirectoryHandle> {
    return this.fs.getOrCreateDir(this.requireRoot(), NOTES_DIR);
  }

  private async trashDir(root: FsDirectoryHandle): Promise<FsDirectoryHandle> {
    const meta = await this.fs.getOrCreateDir(root, TRASH_DIR);
    const trash = await this.fs.getOrCreateDir(meta, TRASH_SUBDIR);
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
    let cursor = trash;
    for (const part of today.split('/')) {
      cursor = await this.fs.getOrCreateDir(cursor, part);
    }
    return cursor;
  }

  private async findPath(dir: FsDirectoryHandle, id: string): Promise<string> {
    const cached = this.idToPath.get(id);
    if (cached) return cached;
    for await (const entry of walkEntities(this.fs, dir, NOTE_FILE_SUFFIX)) {
      try {
        const raw = await this.fs.readJson<Note>(entry.dirHandle, entry.filename);
        if (raw.id === id) {
          this.idToPath.set(id, entry.relativePath);
          return entry.relativePath;
        }
      } catch {
        /* skip corrupt */
      }
    }
    throw new AppError(ERROR_CODES.FS_003, { severity: 'error', context: { id } });
  }

  private async allocFilename(dir: FsDirectoryHandle, title: string): Promise<string> {
    const base = toSlug(title);
    for (let n = 1; n < 1000; n++) {
      const candidate = `${withSuffix(base, n)}${NOTE_FILE_SUFFIX}`;
      const exists = await this.fs.hasEntry(dir, candidate);
      if (!exists) return candidate;
    }
    throw new AppError(ERROR_CODES.FS_001, {
      severity: 'error',
      context: { reason: 'slug exhaustion', base },
    });
  }

  private async allocAvailable(dir: FsDirectoryHandle, name: string): Promise<string> {
    if (!(await this.fs.hasEntry(dir, name))) return name;
    const dot = name.lastIndexOf('.');
    const stem = dot >= 0 ? name.slice(0, dot) : name;
    const ext = dot >= 0 ? name.slice(dot) : '';
    for (let n = 1; n < 1000; n++) {
      const candidate = `${stem}-${n}${ext}`;
      if (!(await this.fs.hasEntry(dir, candidate))) return candidate;
    }
    throw new AppError(ERROR_CODES.FS_001, { severity: 'error' });
  }

  private toSummary(note: Note, folder: string): NoteSummary {
    return {
      id: note.id,
      title: note.title,
      updatedAt: note.updatedAt,
      tags: note.tags,
      folder,
      position: note.position ?? '',
      preview: buildPreview(note.body),
    };
  }

  private toSearchDoc(note: Note): SearchDoc {
    const tagIds = this.dropStaleTags(note.tags);
    const tagLabels = tagIds
      .map((id) => this.tags.byId(id)?.label ?? '')
      .filter((l) => l !== '')
      .join(' ');
    const body = extractPlainText(note.body);
    return {
      id: note.id,
      kind: NOTE_KIND,
      title: note.title,
      body: tagLabels === '' ? body : `${body} ${tagLabels}`,
      tagIds,
    };
  }

  private dropStaleTags(tagIds: readonly string[]): readonly string[] {
    if (tagIds.length === 0) return tagIds;
    return tagIds.filter((id) => this.tags.byId(id) !== undefined);
  }
}

const PREVIEW_MAX = 280;
const buildPreview = (body: Note['body']): string => {
  const text = extractPlainText(body);
  return text.length > PREVIEW_MAX ? `${text.slice(0, PREVIEW_MAX - 1).trimEnd()}…` : text;
};

const compareLegacy = (a: NoteSummary, b: NoteSummary): number =>
  b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);

const comparePosition = (a: NoteSummary, b: NoteSummary): number => {
  if (a.position === '' && b.position === '') return compareLegacy(a, b);
  if (a.position === '') return 1;
  if (b.position === '') return -1;
  return a.position < b.position ? -1 : a.position > b.position ? 1 : 0;
};

const sortByPosition = (list: readonly NoteSummary[]): NoteSummary[] =>
  [...list].sort(comparePosition);

const lastPosition = (list: readonly NoteSummary[]): string | null => {
  let max: string | null = null;
  for (const s of list) {
    if (s.position !== '' && (max === null || s.position > max)) max = s.position;
  }
  return max;
};
