import { Injectable, computed, inject, signal } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { ErrorService } from '@core/errors/error.service';
import { FsService } from '@core/fs/fs.service';
import type { NativeDirRef } from '@core/fs/native-fs.types';
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
  DEFAULT_WRITING_REMINDER,
  WRITING_FILE_SUFFIX,
  WRITING_KIND,
  WRITING_SCHEMA_VERSION,
  WRITINGS_DIR,
  emptyDoc,
  type Writing,
  type WritingSummary,
} from '../models/writing.types';
import { buildWritingPreview } from './writing-preview';
import { writingDeadlineMigrationStep } from './writing-deadline.migration';

const TRASH_DIR = '.mi-cerebro';
const TRASH_SUBDIR = 'trash';

@Injectable({ providedIn: 'root' })
export class WritingsService {
  private readonly fs = inject(FsService);
  private readonly workspace = inject(WorkspaceService);
  private readonly migrations = inject(MigrationsService);
  private readonly search = inject(SearchIndexService);
  private readonly tags = inject(TagsService);
  private readonly errors = inject(ErrorService);

  private readonly idToPath = new Map<string, string>();
  private readonly summariesSignal = signal<readonly WritingSummary[]>([]);
  readonly summaries = this.summariesSignal.asReadonly();
  private readonly foldersSignal = signal<readonly string[]>([]);
  readonly folders = this.foldersSignal.asReadonly();
  readonly foldersSet = computed(() => new Set(this.foldersSignal()));

  constructor() {
    this.migrations.register({
      kind: WRITING_KIND,
      latest: WRITING_SCHEMA_VERSION,
      steps: [
        blockIdMigrationStep(1),
        positionSeedMigrationStep(2),
        writingDeadlineMigrationStep(3),
      ],
    });
  }

  async refresh(): Promise<readonly WritingSummary[]> {
    const dir = await this.writingsDir();
    this.idToPath.clear();
    const summaries: WritingSummary[] = [];
    const indexDocs: SearchDoc[] = [];
    const writingsById = new Map<string, Writing>();
    let skipped = 0;
    for await (const entry of walkEntities(this.fs, dir, WRITING_FILE_SUFFIX)) {
      try {
        const raw = await this.fs.readJson<Writing>(entry.dirHandle, entry.filename);
        const writing = await this.migrations.migrate<Writing>(WRITING_KIND, raw);
        this.idToPath.set(writing.id, entry.relativePath);
        writingsById.set(writing.id, writing);
        summaries.push(this.toSummary(writing, entry.folder));
        indexDocs.push(this.toSearchDoc(writing));
      } catch (cause) {
        skipped++;
        console.warn('[writings] skipped unreadable file', entry.relativePath, cause);
      }
    }
    this.errors.reportSkippedEntries(skipped, { area: 'writings' });
    summaries.sort(compareLegacy);
    const seeds = seedMissingPositions(summaries);
    if (seeds.length > 0) {
      const positionById = new Map(seeds.map((s) => [s.id, s.position] as const));
      for (const [id, pos] of positionById) {
        const writing = writingsById.get(id);
        if (writing) await this.writePositionInPlace(writing, pos);
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
    await this.search.rebuildKind(WRITING_KIND, indexDocs);
    return summaries;
  }

  async create(title = '', folder = ''): Promise<Writing> {
    const root = await this.writingsDir();
    const targetDir = await getOrCreateDirByPath(this.fs, root, folder);
    const now = new Date().toISOString();
    const position = nextPositionAfter(lastPosition(this.summariesSignal()));
    const writing: Writing = {
      id: crypto.randomUUID(),
      title,
      body: emptyDoc(),
      tags: [],
      deadline: null,
      reminder: DEFAULT_WRITING_REMINDER,
      createdAt: now,
      updatedAt: now,
      schemaVersion: WRITING_SCHEMA_VERSION,
      position,
    };
    const filename = await this.allocFilename(targetDir, title);
    await this.fs.writeFileAtomic(targetDir, filename, JSON.stringify(writing, null, 2));
    this.idToPath.set(writing.id, joinPath(folder, filename));
    this.summariesSignal.update((curr) =>
      sortByPosition([...curr, this.toSummary(writing, folder)]),
    );
    if (folder !== '' && !this.foldersSet().has(folder)) {
      this.foldersSignal.update((curr) => [...curr, folder]);
    }
    await this.search.upsert(this.toSearchDoc(writing));
    return writing;
  }

  async read(id: string): Promise<Writing> {
    const dir = await this.writingsDir();
    const { folder, filename } = splitRelativePath(await this.findPath(dir, id));
    const subdir = await getDirByPath(this.fs, dir, folder);
    if (!subdir) throw new AppError(ERROR_CODES.FS_003, { severity: 'error', context: { id } });
    const raw = await this.fs.readJson<Writing>(subdir, filename);
    return this.migrations.migrate<Writing>(WRITING_KIND, raw);
  }

  async save(writing: Writing): Promise<Writing> {
    const dir = await this.writingsDir();
    const cleanTags = this.dropStaleTags(writing.tags);
    const updated: Writing = { ...writing, tags: cleanTags, updatedAt: new Date().toISOString() };
    const { folder, filename } = splitRelativePath(await this.findPath(dir, writing.id));
    const subdir = await getDirByPath(this.fs, dir, folder);
    if (!subdir) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    await this.fs.writeFileAtomic(subdir, filename, JSON.stringify(updated, null, 2));
    this.summariesSignal.update((curr) =>
      sortByPosition(curr.map((s) => (s.id === writing.id ? this.toSummary(updated, folder) : s))),
    );
    await this.search.upsert(this.toSearchDoc(updated));
    return updated;
  }

  async setPosition(id: string, position: string): Promise<void> {
    const writing = await this.read(id);
    const updated: Writing = { ...writing, position, updatedAt: new Date().toISOString() };
    const dir = await this.writingsDir();
    const { folder, filename } = splitRelativePath(await this.findPath(dir, id));
    const subdir = await getDirByPath(this.fs, dir, folder);
    if (!subdir) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    await this.fs.writeFileAtomic(subdir, filename, JSON.stringify(updated, null, 2));
    this.summariesSignal.update((curr) =>
      sortByPosition(curr.map((s) => (s.id === id ? { ...s, position } : s))),
    );
  }

  private async writePositionInPlace(writing: Writing, position: string): Promise<void> {
    const dir = await this.writingsDir();
    const { folder, filename } = splitRelativePath(await this.findPath(dir, writing.id));
    const subdir = await getDirByPath(this.fs, dir, folder);
    if (!subdir) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    const seeded: Writing = { ...writing, position };
    await this.fs.writeFileAtomic(subdir, filename, JSON.stringify(seeded, null, 2));
  }

  async deleteToTrash(id: string): Promise<void> {
    const root = this.requireRoot();
    const dir = await this.writingsDir();
    const { folder, filename } = splitRelativePath(await this.findPath(dir, id));
    const subdir = await getDirByPath(this.fs, dir, folder);
    if (!subdir) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    const trashDir = await this.trashDir(root);
    const dest = `${WRITING_KIND}__${id}__${filename}`;
    await this.fs.moveFile(subdir, filename, trashDir, dest);
    this.idToPath.delete(id);
    this.summariesSignal.update((curr) => curr.filter((s) => s.id !== id));
    await this.search.remove(id);
  }

  async moveToFolder(id: string, newFolder: string): Promise<void> {
    const dir = await this.writingsDir();
    const { folder: oldFolder, filename } = splitRelativePath(await this.findPath(dir, id));
    if (oldFolder === newFolder) return;
    const src = await getDirByPath(this.fs, dir, oldFolder);
    if (!src) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    const dest = await getOrCreateDirByPath(this.fs, dir, newFolder);
    const destName = await this.allocAvailable(dest, filename);
    await this.fs.moveFile(src, filename, dest, destName);
    this.idToPath.set(id, joinPath(newFolder, destName));
    this.summariesSignal.update((curr) =>
      curr.map((s) => (s.id === id ? { ...s, folder: newFolder } : s)),
    );
    if (newFolder !== '' && !this.foldersSet().has(newFolder)) {
      this.foldersSignal.update((curr) => [...curr, newFolder]);
    }
  }

  setKnownPath(id: string, relativePath: string): void {
    this.idToPath.set(id, relativePath);
  }

  private requireRoot(): NativeDirRef {
    const root = this.workspace.root();
    if (!root) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    return root;
  }

  private async writingsDir(): Promise<NativeDirRef> {
    return this.fs.getOrCreateDir(this.requireRoot(), WRITINGS_DIR);
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

  private async findPath(dir: NativeDirRef, id: string): Promise<string> {
    const cached = this.idToPath.get(id);
    if (cached) return cached;
    for await (const entry of walkEntities(this.fs, dir, WRITING_FILE_SUFFIX)) {
      try {
        const raw = await this.fs.readJson<Writing>(entry.dirHandle, entry.filename);
        if (raw.id === id) {
          this.idToPath.set(id, entry.relativePath);
          return entry.relativePath;
        }
      } catch {
        /* skip corrupt */
      }
    }
    throw new AppError(ERROR_CODES.FS_008, { severity: 'error', context: { id } });
  }

  private async allocFilename(dir: NativeDirRef, title: string): Promise<string> {
    const base = toSlug(title);
    for (let n = 1; n < 1000; n++) {
      const candidate = `${withSuffix(base, n)}${WRITING_FILE_SUFFIX}`;
      if (!(await this.fs.hasEntry(dir, candidate))) return candidate;
    }
    throw new AppError(ERROR_CODES.FS_001, {
      severity: 'error',
      context: { reason: 'slug exhaustion', base },
    });
  }

  private async allocAvailable(dir: NativeDirRef, name: string): Promise<string> {
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

  private toSummary(writing: Writing, folder: string): WritingSummary {
    const { preview, wordCount } = buildWritingPreview(writing.body);
    return {
      id: writing.id,
      title: writing.title,
      deadline: writing.deadline,
      reminder: writing.reminder,
      updatedAt: writing.updatedAt,
      tags: writing.tags,
      folder,
      position: writing.position ?? '',
      preview,
      wordCount,
    };
  }

  private toSearchDoc(writing: Writing): SearchDoc {
    const tagIds = this.dropStaleTags(writing.tags);
    const tagLabels = tagIds
      .map((id) => this.tags.byId(id)?.label ?? '')
      .filter((l) => l !== '')
      .join(' ');
    const body = extractPlainText(writing.body);
    return {
      id: writing.id,
      kind: WRITING_KIND,
      title: writing.title,
      body: tagLabels === '' ? body : `${body} ${tagLabels}`,
      tagIds,
    };
  }

  private dropStaleTags(tagIds: readonly string[]): readonly string[] {
    if (tagIds.length === 0) return tagIds;
    return tagIds.filter((id) => this.tags.byId(id) !== undefined);
  }
}

const compareLegacy = (a: WritingSummary, b: WritingSummary): number =>
  b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);

const comparePosition = (a: WritingSummary, b: WritingSummary): number => {
  if (a.position === '' && b.position === '') return compareLegacy(a, b);
  if (a.position === '') return 1;
  if (b.position === '') return -1;
  return a.position < b.position ? -1 : a.position > b.position ? 1 : 0;
};

const sortByPosition = (list: readonly WritingSummary[]): WritingSummary[] =>
  [...list].sort(comparePosition);

const lastPosition = (list: readonly WritingSummary[]): string | null => {
  let max: string | null = null;
  for (const s of list) {
    if (s.position !== '' && (max === null || s.position > max)) max = s.position;
  }
  return max;
};
