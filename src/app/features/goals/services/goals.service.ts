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
  DEFAULT_GOAL_PRIORITY,
  GOAL_FILE_SUFFIX,
  GOAL_KIND,
  GOAL_SCHEMA_VERSION,
  GOALS_DIR,
  clampProgress,
  emptyDoc,
  type Goal,
  type GoalSummary,
} from '../models/goal.types';
import { goalPriorityProgressMigrationStep } from './priority-progress.migration';

const TRASH_DIR = '.mi-cerebro';
const TRASH_SUBDIR = 'trash';

@Injectable({ providedIn: 'root' })
export class GoalsService {
  private readonly fs = inject(FsService);
  private readonly workspace = inject(WorkspaceService);
  private readonly migrations = inject(MigrationsService);
  private readonly search = inject(SearchIndexService);
  private readonly tags = inject(TagsService);

  private readonly idToPath = new Map<string, string>();
  private readonly summariesSignal = signal<readonly GoalSummary[]>([]);
  readonly summaries = this.summariesSignal.asReadonly();
  private readonly foldersSignal = signal<readonly string[]>([]);
  readonly folders = this.foldersSignal.asReadonly();
  readonly foldersSet = computed(() => new Set(this.foldersSignal()));

  constructor() {
    this.migrations.register({
      kind: GOAL_KIND,
      latest: GOAL_SCHEMA_VERSION,
      steps: [
        blockIdMigrationStep(1),
        positionSeedMigrationStep(2),
        goalPriorityProgressMigrationStep(3),
      ],
    });
  }

  async refresh(): Promise<readonly GoalSummary[]> {
    const dir = await this.goalsDir();
    this.idToPath.clear();
    const summaries: GoalSummary[] = [];
    const indexDocs: SearchDoc[] = [];
    const goalsById = new Map<string, Goal>();
    for await (const entry of walkEntities(this.fs, dir, GOAL_FILE_SUFFIX)) {
      try {
        const raw = await this.fs.readJson<Goal>(entry.dirHandle, entry.filename);
        const goal = await this.migrations.migrate<Goal>(GOAL_KIND, raw);
        this.idToPath.set(goal.id, entry.relativePath);
        goalsById.set(goal.id, goal);
        summaries.push(this.toSummary(goal, entry.folder));
        indexDocs.push(this.toSearchDoc(goal));
      } catch (cause) {
        console.warn('[goals] skipped unreadable file', entry.relativePath, cause);
      }
    }
    summaries.sort(compareSummaries);
    const seeds = seedMissingPositions(summaries);
    if (seeds.length > 0) {
      const positionById = new Map(seeds.map((s) => [s.id, s.position] as const));
      for (const [id, pos] of positionById) {
        const goal = goalsById.get(id);
        if (goal) await this.writePositionInPlace(goal, pos);
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

  async create(title = '', folder = ''): Promise<Goal> {
    const root = await this.goalsDir();
    const targetDir = await getOrCreateDirByPath(this.fs, root, folder);
    const now = new Date().toISOString();
    const position = nextPositionAfter(lastPosition(this.summariesSignal()));
    const goal: Goal = {
      id: crypto.randomUUID(),
      title,
      body: emptyDoc(),
      tags: [],
      deadline: null,
      completed: false,
      priority: DEFAULT_GOAL_PRIORITY,
      progress: 0,
      createdAt: now,
      updatedAt: now,
      schemaVersion: GOAL_SCHEMA_VERSION,
      position,
    };
    const filename = await this.allocFilename(targetDir, title);
    await this.fs.writeFileAtomic(targetDir, filename, JSON.stringify(goal, null, 2));
    this.idToPath.set(goal.id, joinPath(folder, filename));
    this.summariesSignal.update((list) => sortByPosition([...list, this.toSummary(goal, folder)]));
    if (folder !== '' && !this.foldersSet().has(folder)) {
      this.foldersSignal.update((list) => [...list, folder]);
    }
    await this.search.upsert(this.toSearchDoc(goal));
    return goal;
  }

  async read(id: string): Promise<Goal> {
    const dir = await this.goalsDir();
    const { folder, filename } = splitRelativePath(await this.findPath(dir, id));
    const subdir = await getDirByPath(this.fs, dir, folder);
    if (!subdir) throw new AppError(ERROR_CODES.FS_003, { severity: 'error', context: { id } });
    const raw = await this.fs.readJson<Goal>(subdir, filename);
    return this.migrations.migrate<Goal>(GOAL_KIND, raw);
  }

  async save(goal: Goal): Promise<Goal> {
    const dir = await this.goalsDir();
    const cleanTags = this.dropStaleTags(goal.tags);
    const progress = goal.completed ? 100 : clampProgress(goal.progress);
    const updated: Goal = {
      ...goal,
      tags: cleanTags,
      progress,
      updatedAt: new Date().toISOString(),
    };
    const { folder, filename } = splitRelativePath(await this.findPath(dir, goal.id));
    const subdir = await getDirByPath(this.fs, dir, folder);
    if (!subdir) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    await this.fs.writeFileAtomic(subdir, filename, JSON.stringify(updated, null, 2));
    this.summariesSignal.update((list) =>
      sortByPosition(list.map((s) => (s.id === goal.id ? this.toSummary(updated, folder) : s))),
    );
    await this.search.upsert(this.toSearchDoc(updated));
    return updated;
  }

  async setPosition(id: string, position: string): Promise<void> {
    const goal = await this.read(id);
    const updated: Goal = { ...goal, position, updatedAt: new Date().toISOString() };
    const dir = await this.goalsDir();
    const { folder, filename } = splitRelativePath(await this.findPath(dir, id));
    const subdir = await getDirByPath(this.fs, dir, folder);
    if (!subdir) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    await this.fs.writeFileAtomic(subdir, filename, JSON.stringify(updated, null, 2));
    this.summariesSignal.update((list) =>
      sortByPosition(list.map((s) => (s.id === id ? { ...s, position } : s))),
    );
  }

  private async writePositionInPlace(goal: Goal, position: string): Promise<void> {
    const dir = await this.goalsDir();
    const { folder, filename } = splitRelativePath(await this.findPath(dir, goal.id));
    const subdir = await getDirByPath(this.fs, dir, folder);
    if (!subdir) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    const seeded: Goal = { ...goal, position };
    await this.fs.writeFileAtomic(subdir, filename, JSON.stringify(seeded, null, 2));
  }

  async deleteToTrash(id: string): Promise<void> {
    const root = this.requireRoot();
    const dir = await this.goalsDir();
    const { folder, filename } = splitRelativePath(await this.findPath(dir, id));
    const subdir = await getDirByPath(this.fs, dir, folder);
    if (!subdir) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    const trashDir = await this.trashDir(root);
    const dest = `${GOAL_KIND}__${id}__${filename}`;
    await this.fs.moveFile(subdir, filename, trashDir, dest);
    this.idToPath.delete(id);
    this.summariesSignal.update((list) => list.filter((s) => s.id !== id));
    await this.search.remove(id);
  }

  async moveToFolder(id: string, newFolder: string): Promise<void> {
    const dir = await this.goalsDir();
    const { folder: oldFolder, filename } = splitRelativePath(await this.findPath(dir, id));
    if (oldFolder === newFolder) return;
    const src = await getDirByPath(this.fs, dir, oldFolder);
    if (!src) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    const dest = await getOrCreateDirByPath(this.fs, dir, newFolder);
    const destName = await this.allocAvailable(dest, filename);
    await this.fs.moveFile(src, filename, dest, destName);
    this.idToPath.set(id, joinPath(newFolder, destName));
    this.summariesSignal.update((list) =>
      sortByPosition(list.map((s) => (s.id === id ? { ...s, folder: newFolder } : s))),
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

  private async goalsDir(): Promise<FsDirectoryHandle> {
    return this.fs.getOrCreateDir(this.requireRoot(), GOALS_DIR);
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
    for await (const entry of walkEntities(this.fs, dir, GOAL_FILE_SUFFIX)) {
      try {
        const raw = await this.fs.readJson<Goal>(entry.dirHandle, entry.filename);
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
      const candidate = `${withSuffix(base, n)}${GOAL_FILE_SUFFIX}`;
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

  private toSummary(goal: Goal, folder: string): GoalSummary {
    return {
      id: goal.id,
      title: goal.title,
      deadline: goal.deadline,
      completed: goal.completed,
      priority: goal.priority,
      progress: goal.progress,
      updatedAt: goal.updatedAt,
      tags: goal.tags,
      folder,
      position: goal.position ?? '',
    };
  }

  private toSearchDoc(goal: Goal): SearchDoc {
    const tagIds = this.dropStaleTags(goal.tags);
    const tagLabels = tagIds
      .map((id) => this.tags.byId(id)?.label ?? '')
      .filter((l) => l !== '')
      .join(' ');
    const body = extractPlainText(goal.body);
    return {
      id: goal.id,
      kind: GOAL_KIND,
      title: goal.title,
      body: tagLabels === '' ? body : `${body} ${tagLabels}`,
      tagIds,
    };
  }

  private dropStaleTags(tagIds: readonly string[]): readonly string[] {
    if (tagIds.length === 0) return tagIds;
    return tagIds.filter((id) => this.tags.byId(id) !== undefined);
  }
}

const compareSummaries = (a: GoalSummary, b: GoalSummary): number => {
  if (a.completed !== b.completed) return a.completed ? 1 : -1;
  if (!a.completed) {
    const aKey = a.deadline ?? `~${a.updatedAt}`;
    const bKey = b.deadline ?? `~${b.updatedAt}`;
    return aKey.localeCompare(bKey) || a.id.localeCompare(b.id);
  }
  return b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);
};

const comparePosition = (a: GoalSummary, b: GoalSummary): number => {
  if (a.position === '' && b.position === '') return compareSummaries(a, b);
  if (a.position === '') return 1;
  if (b.position === '') return -1;
  return a.position < b.position ? -1 : a.position > b.position ? 1 : 0;
};

const sortByPosition = (list: readonly GoalSummary[]): GoalSummary[] =>
  [...list].sort(comparePosition);

const lastPosition = (list: readonly GoalSummary[]): string | null => {
  let max: string | null = null;
  for (const s of list) {
    if (s.position !== '' && (max === null || s.position > max)) max = s.position;
  }
  return max;
};
