import { Injectable, computed, inject, signal } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
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
import { enteredHoyAtMigrationStep } from './entered-hoy-at.migration';
import { taskReminderConfigMigrationStep } from './task-reminder-config.migration';
import type { SearchDoc } from '@core/search/search.types';
import { extractPlainText } from '@core/search/tiptap-text';
import { TagsService } from '@core/tags/tags.service';
import { toSlug, withSuffix } from '@shared/utils/slug';

import {
  DEFAULT_TASK_REMINDER,
  TASK_FILE_SUFFIX,
  TASK_KIND,
  TASK_SCHEMA_VERSION,
  TASKS_DIR,
  emptyDoc,
  sortDueDates,
  type Task,
  type TaskSummary,
} from '../models/task.types';
import { type Bucket, bucketToDueDate } from './task-buckets';

const TRASH_DIR = '.mi-cerebro';
const TRASH_SUBDIR = 'trash';

@Injectable({ providedIn: 'root' })
export class TasksService {
  private readonly fs = inject(FsService);
  private readonly workspace = inject(WorkspaceService);
  private readonly migrations = inject(MigrationsService);
  private readonly search = inject(SearchIndexService);
  private readonly tags = inject(TagsService);

  private readonly idToPath = new Map<string, string>();
  private readonly summariesSignal = signal<readonly TaskSummary[]>([]);
  readonly summaries = this.summariesSignal.asReadonly();
  private readonly foldersSignal = signal<readonly string[]>([]);
  readonly folders = this.foldersSignal.asReadonly();
  readonly foldersSet = computed(() => new Set(this.foldersSignal()));

  constructor() {
    this.migrations.register({
      kind: TASK_KIND,
      latest: TASK_SCHEMA_VERSION,
      steps: [
        blockIdMigrationStep(1),
        positionSeedMigrationStep(2),
        enteredHoyAtMigrationStep(3),
        taskReminderConfigMigrationStep(4),
      ],
    });
  }

  async refresh(): Promise<readonly TaskSummary[]> {
    const dir = await this.tasksDir();
    this.idToPath.clear();
    const summaries: TaskSummary[] = [];
    const indexDocs: SearchDoc[] = [];
    const tasksById = new Map<string, Task>();
    for await (const entry of walkEntities(this.fs, dir, TASK_FILE_SUFFIX)) {
      try {
        const raw = await this.fs.readJson<Task>(entry.dirHandle, entry.filename);
        const task = await this.migrations.migrate<Task>(TASK_KIND, raw);
        this.idToPath.set(task.id, entry.relativePath);
        tasksById.set(task.id, task);
        summaries.push(this.toSummary(task, entry.folder));
        indexDocs.push(this.toSearchDoc(task));
      } catch (cause) {
        console.warn('[tasks] skipped unreadable file', entry.relativePath, cause);
      }
    }
    summaries.sort(compareSummaries);
    const seeds = seedMissingPositions(summaries);
    if (seeds.length > 0) {
      const positionById = new Map(seeds.map((s) => [s.id, s.position] as const));
      for (const [id, pos] of positionById) {
        const task = tasksById.get(id);
        if (task) await this.writePositionInPlace(task, pos);
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
    await this.search.rebuildKind(TASK_KIND, indexDocs);
    return summaries;
  }

  async create(title = '', folder = ''): Promise<Task> {
    const root = await this.tasksDir();
    const targetDir = await getOrCreateDirByPath(this.fs, root, folder);
    const now = new Date().toISOString();
    const position = nextPositionAfter(lastPosition(this.summariesSignal()));
    const task: Task = {
      id: crypto.randomUUID(),
      title,
      body: emptyDoc(),
      tags: [],
      done: false,
      dueDates: [],
      reminder: DEFAULT_TASK_REMINDER,
      createdAt: now,
      updatedAt: now,
      schemaVersion: TASK_SCHEMA_VERSION,
      position,
    };
    const filename = await this.allocFilename(targetDir, title);
    await this.fs.writeFileAtomic(targetDir, filename, JSON.stringify(task, null, 2));
    this.idToPath.set(task.id, joinPath(folder, filename));
    this.summariesSignal.update((list) => sortByPosition([...list, this.toSummary(task, folder)]));
    if (folder !== '' && !this.foldersSet().has(folder)) {
      this.foldersSignal.update((list) => [...list, folder]);
    }
    await this.search.upsert(this.toSearchDoc(task));
    return task;
  }

  async read(id: string): Promise<Task> {
    const dir = await this.tasksDir();
    const { folder, filename } = splitRelativePath(await this.findPath(dir, id));
    const subdir = await getDirByPath(this.fs, dir, folder);
    if (!subdir) throw new AppError(ERROR_CODES.FS_003, { severity: 'error', context: { id } });
    const raw = await this.fs.readJson<Task>(subdir, filename);
    return this.migrations.migrate<Task>(TASK_KIND, raw);
  }

  async save(task: Task): Promise<Task> {
    const dir = await this.tasksDir();
    const cleanTags = this.dropStaleTags(task.tags);
    const updated: Task = {
      ...task,
      tags: cleanTags,
      dueDates: sortDueDates(task.dueDates),
      updatedAt: new Date().toISOString(),
    };
    const { folder, filename } = splitRelativePath(await this.findPath(dir, task.id));
    const subdir = await getDirByPath(this.fs, dir, folder);
    if (!subdir) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    await this.fs.writeFileAtomic(subdir, filename, JSON.stringify(updated, null, 2));
    this.summariesSignal.update((list) =>
      sortByPosition(list.map((s) => (s.id === task.id ? this.toSummary(updated, folder) : s))),
    );
    await this.search.upsert(this.toSearchDoc(updated));
    return updated;
  }

  // why: used by the calendar's drag-to-reschedule — moves one specific
  //      due date to a new day without disturbing the task's other dates
  //      (a task can have several, see `Task.dueDates`).
  async rescheduleDueDate(id: string, fromIso: string, toIso: string): Promise<Task> {
    const task = await this.read(id);
    if (fromIso === toIso) return task;
    const idx = task.dueDates.indexOf(fromIso);
    const dueDates =
      idx >= 0 ? task.dueDates.map((d, i) => (i === idx ? toIso : d)) : [...task.dueDates, toIso];
    return this.save({ ...task, dueDates });
  }

  async transplant(id: string, bucket: Bucket, now: Date = new Date()): Promise<Task> {
    const task = await this.read(id);
    const dueDates = sortDueDates(bucketToDueDate(bucket, now));
    const wasInHoy = task.enteredHoyAt !== undefined;
    const goesToHoy = bucket === 'today';
    const enteredHoyAt = goesToHoy ? (wasInHoy ? task.enteredHoyAt : now.toISOString()) : undefined;
    const { enteredHoyAt: _drop, ...rest } = task;
    void _drop;
    const next: Task = {
      ...rest,
      dueDates,
      ...(enteredHoyAt !== undefined ? { enteredHoyAt } : {}),
    };
    return this.save(next);
  }

  async harvest(id: string, now: Date = new Date()): Promise<Task> {
    const task = await this.read(id);
    return this.save({ ...task, done: true, updatedAt: now.toISOString() });
  }

  // why: dev-only helper — retrocede `enteredHoyAt` y marca `done` para poder
  //      verificar el patio (umbral árbol = 14 días). Sólo se invoca tras
  //      check de `isDevMode()` desde la UI; igual queda en el service para
  //      no diseminar lógica de retrodatado por containers.
  async devAgeAndHarvest(id: string, daysAgo: number): Promise<Task> {
    const task = await this.read(id);
    const aged = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
    return this.save({ ...task, enteredHoyAt: aged, done: true });
  }

  async setPosition(id: string, position: string): Promise<void> {
    const task = await this.read(id);
    const updated: Task = { ...task, position, updatedAt: new Date().toISOString() };
    const dir = await this.tasksDir();
    const { folder, filename } = splitRelativePath(await this.findPath(dir, id));
    const subdir = await getDirByPath(this.fs, dir, folder);
    if (!subdir) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    await this.fs.writeFileAtomic(subdir, filename, JSON.stringify(updated, null, 2));
    this.summariesSignal.update((list) =>
      sortByPosition(list.map((s) => (s.id === id ? { ...s, position } : s))),
    );
  }

  private async writePositionInPlace(task: Task, position: string): Promise<void> {
    const dir = await this.tasksDir();
    const { folder, filename } = splitRelativePath(await this.findPath(dir, task.id));
    const subdir = await getDirByPath(this.fs, dir, folder);
    if (!subdir) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    const seeded: Task = { ...task, position };
    await this.fs.writeFileAtomic(subdir, filename, JSON.stringify(seeded, null, 2));
  }

  async deleteToTrash(id: string): Promise<void> {
    const root = this.requireRoot();
    const dir = await this.tasksDir();
    const { folder, filename } = splitRelativePath(await this.findPath(dir, id));
    const subdir = await getDirByPath(this.fs, dir, folder);
    if (!subdir) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    const trashDir = await this.trashDir(root);
    const dest = `${TASK_KIND}__${id}__${filename}`;
    await this.fs.moveFile(subdir, filename, trashDir, dest);
    this.idToPath.delete(id);
    this.summariesSignal.update((list) => list.filter((s) => s.id !== id));
    await this.search.remove(id);
  }

  async moveToFolder(id: string, newFolder: string): Promise<void> {
    const dir = await this.tasksDir();
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

  private requireRoot(): NativeDirRef {
    const root = this.workspace.root();
    if (!root) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    return root;
  }

  private async tasksDir(): Promise<NativeDirRef> {
    return this.fs.getOrCreateDir(this.requireRoot(), TASKS_DIR);
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
    for await (const entry of walkEntities(this.fs, dir, TASK_FILE_SUFFIX)) {
      try {
        const raw = await this.fs.readJson<Task>(entry.dirHandle, entry.filename);
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
      const candidate = `${withSuffix(base, n)}${TASK_FILE_SUFFIX}`;
      const exists = await this.fs.hasEntry(dir, candidate);
      if (!exists) return candidate;
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

  private toSummary(task: Task, folder: string): TaskSummary {
    return {
      id: task.id,
      title: task.title,
      done: task.done,
      dueDates: task.dueDates,
      reminder: task.reminder,
      updatedAt: task.updatedAt,
      tags: task.tags,
      folder,
      position: task.position ?? '',
      ...(task.enteredHoyAt !== undefined ? { enteredHoyAt: task.enteredHoyAt } : {}),
    };
  }

  private toSearchDoc(task: Task): SearchDoc {
    const tagIds = this.dropStaleTags(task.tags);
    const tagLabels = tagIds
      .map((id) => this.tags.byId(id)?.label ?? '')
      .filter((l) => l !== '')
      .join(' ');
    const body = extractPlainText(task.body);
    return {
      id: task.id,
      kind: TASK_KIND,
      title: task.title,
      body: tagLabels === '' ? body : `${body} ${tagLabels}`,
      tagIds,
    };
  }

  private dropStaleTags(tagIds: readonly string[]): readonly string[] {
    if (tagIds.length === 0) return tagIds;
    return tagIds.filter((id) => this.tags.byId(id) !== undefined);
  }
}

const compareSummaries = (a: TaskSummary, b: TaskSummary): number => {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (!a.done) {
    const aKey = a.dueDates[0] ?? `~${a.updatedAt}`;
    const bKey = b.dueDates[0] ?? `~${b.updatedAt}`;
    return aKey.localeCompare(bKey) || a.id.localeCompare(b.id);
  }
  return b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);
};

const comparePosition = (a: TaskSummary, b: TaskSummary): number => {
  if (a.position === '' && b.position === '') return compareSummaries(a, b);
  if (a.position === '') return 1;
  if (b.position === '') return -1;
  return a.position < b.position ? -1 : a.position > b.position ? 1 : 0;
};

const sortByPosition = (list: readonly TaskSummary[]): TaskSummary[] =>
  [...list].sort(comparePosition);

const lastPosition = (list: readonly TaskSummary[]): string | null => {
  let max: string | null = null;
  for (const s of list) {
    if (s.position !== '' && (max === null || s.position > max)) max = s.position;
  }
  return max;
};
