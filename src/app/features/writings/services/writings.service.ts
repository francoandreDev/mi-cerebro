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
import { SearchIndexService } from '@core/search/search-index.service';
import { blockIdMigrationStep } from '@core/tiptap/block-id/block-id.migration';
import type { SearchDoc } from '@core/search/search.types';
import { extractPlainText } from '@core/search/tiptap-text';
import { TagsService } from '@core/tags/tags.service';
import { toSlug, withSuffix } from '@shared/utils/slug';

import {
  WRITING_FILE_SUFFIX,
  WRITING_KIND,
  WRITING_SCHEMA_VERSION,
  WRITINGS_DIR,
  emptyDoc,
  type Writing,
  type WritingSummary,
} from '../models/writing.types';

const TRASH_DIR = '.mi-cerebro';
const TRASH_SUBDIR = 'trash';

@Injectable({ providedIn: 'root' })
export class WritingsService {
  private readonly fs = inject(FsService);
  private readonly workspace = inject(WorkspaceService);
  private readonly migrations = inject(MigrationsService);
  private readonly search = inject(SearchIndexService);
  private readonly tags = inject(TagsService);

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
      steps: [blockIdMigrationStep(1)],
    });
  }

  async refresh(): Promise<readonly WritingSummary[]> {
    const dir = await this.writingsDir();
    this.idToPath.clear();
    const summaries: WritingSummary[] = [];
    const indexDocs: SearchDoc[] = [];
    for await (const entry of walkEntities(this.fs, dir, WRITING_FILE_SUFFIX)) {
      try {
        const raw = await this.fs.readJson<Writing>(entry.dirHandle, entry.filename);
        const writing = await this.migrations.migrate<Writing>(WRITING_KIND, raw);
        this.idToPath.set(writing.id, entry.relativePath);
        summaries.push(this.toSummary(writing, entry.folder));
        indexDocs.push(this.toSearchDoc(writing));
      } catch (cause) {
        console.warn('[writings] skipped unreadable file', entry.relativePath, cause);
      }
    }
    summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    this.summariesSignal.set(summaries);
    const folders = await listFolders(this.fs, dir);
    this.foldersSignal.set(folders.map((f) => f.path));
    await this.search.rebuild(indexDocs);
    return summaries;
  }

  async create(title = '', folder = ''): Promise<Writing> {
    const root = await this.writingsDir();
    const targetDir = await getOrCreateDirByPath(this.fs, root, folder);
    const now = new Date().toISOString();
    const writing: Writing = {
      id: crypto.randomUUID(),
      title,
      body: emptyDoc(),
      tags: [],
      createdAt: now,
      updatedAt: now,
      schemaVersion: WRITING_SCHEMA_VERSION,
    };
    const filename = await this.allocFilename(targetDir, title);
    await this.fs.writeFileAtomic(targetDir, filename, JSON.stringify(writing, null, 2));
    this.idToPath.set(writing.id, joinPath(folder, filename));
    this.summariesSignal.update((curr) => [this.toSummary(writing, folder), ...curr]);
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
      curr.map((s) => (s.id === writing.id ? this.toSummary(updated, folder) : s)),
    );
    await this.search.upsert(this.toSearchDoc(updated));
    return updated;
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

  private requireRoot(): FsDirectoryHandle {
    const root = this.workspace.root();
    if (!root) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    return root;
  }

  private async writingsDir(): Promise<FsDirectoryHandle> {
    return this.fs.getOrCreateDir(this.requireRoot(), WRITINGS_DIR);
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
    throw new AppError(ERROR_CODES.FS_003, { severity: 'error', context: { id } });
  }

  private async allocFilename(dir: FsDirectoryHandle, title: string): Promise<string> {
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

  private toSummary(writing: Writing, folder: string): WritingSummary {
    return {
      id: writing.id,
      title: writing.title,
      updatedAt: writing.updatedAt,
      tags: writing.tags,
      folder,
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
