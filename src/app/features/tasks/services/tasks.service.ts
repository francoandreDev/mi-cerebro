import { Injectable, inject, signal } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { FsService } from '@core/fs/fs.service';
import type { FsDirectoryHandle } from '@core/fs/fs.types';
import { WorkspaceService } from '@core/fs/workspace.service';
import { MigrationsService } from '@core/migrations/migrations.service';
import { SearchIndexService } from '@core/search/search-index.service';
import type { SearchDoc } from '@core/search/search.types';
import { extractPlainText } from '@core/search/tiptap-text';
import { TagsService } from '@core/tags/tags.service';
import { toSlug, withSuffix } from '@shared/utils/slug';

import {
  TASK_FILE_SUFFIX,
  TASK_KIND,
  TASK_SCHEMA_VERSION,
  TASKS_DIR,
  emptyDoc,
  sortDueDates,
  type Task,
  type TaskSummary,
} from '../models/task.types';

const TRASH_DIR = '.mi-cerebro';
const TRASH_SUBDIR = 'trash';

@Injectable({ providedIn: 'root' })
export class TasksService {
  private readonly fs = inject(FsService);
  private readonly workspace = inject(WorkspaceService);
  private readonly migrations = inject(MigrationsService);
  private readonly search = inject(SearchIndexService);
  private readonly tags = inject(TagsService);

  private readonly idToFile = new Map<string, string>();
  private readonly summariesSignal = signal<readonly TaskSummary[]>([]);
  readonly summaries = this.summariesSignal.asReadonly();

  constructor() {
    this.migrations.register({ kind: TASK_KIND, latest: TASK_SCHEMA_VERSION, steps: [] });
  }

  async refresh(): Promise<readonly TaskSummary[]> {
    const dir = await this.tasksDir();
    this.idToFile.clear();
    const summaries: TaskSummary[] = [];
    const indexDocs: SearchDoc[] = [];
    for await (const name of this.fs.listFiles(dir, TASK_FILE_SUFFIX)) {
      try {
        const raw = await this.fs.readJson<Task>(dir, name);
        const task = await this.migrations.migrate<Task>(TASK_KIND, raw);
        this.idToFile.set(task.id, name);
        summaries.push(this.toSummary(task));
        indexDocs.push(this.toSearchDoc(task));
      } catch (cause) {
        console.warn('[tasks] skipped unreadable file', name, cause);
      }
    }
    summaries.sort(compareSummaries);
    this.summariesSignal.set(summaries);
    await this.search.rebuild(indexDocs);
    return summaries;
  }

  async create(title = ''): Promise<Task> {
    const dir = await this.tasksDir();
    const now = new Date().toISOString();
    const task: Task = {
      id: crypto.randomUUID(),
      title,
      body: emptyDoc(),
      tags: [],
      done: false,
      dueDates: [],
      createdAt: now,
      updatedAt: now,
      schemaVersion: TASK_SCHEMA_VERSION,
    };
    const filename = await this.allocFilename(dir, title);
    await this.fs.writeFileAtomic(dir, filename, JSON.stringify(task, null, 2));
    this.idToFile.set(task.id, filename);
    this.summariesSignal.update((list) => sortSummaries([this.toSummary(task), ...list]));
    await this.search.upsert(this.toSearchDoc(task));
    return task;
  }

  async read(id: string): Promise<Task> {
    const dir = await this.tasksDir();
    const name = await this.findFilename(dir, id);
    const raw = await this.fs.readJson<Task>(dir, name);
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
    const current = await this.findFilename(dir, task.id);
    await this.fs.writeFileAtomic(dir, current, JSON.stringify(updated, null, 2));
    this.summariesSignal.update((list) =>
      sortSummaries(list.map((s) => (s.id === task.id ? this.toSummary(updated) : s))),
    );
    await this.search.upsert(this.toSearchDoc(updated));
    return updated;
  }

  async deleteToTrash(id: string): Promise<void> {
    const root = this.requireRoot();
    const dir = await this.tasksDir();
    const name = await this.findFilename(dir, id);
    const trashDir = await this.trashDir(root);
    const dest = `${TASK_KIND}__${id}__${name}`;
    await this.fs.moveFile(dir, name, trashDir, dest);
    this.idToFile.delete(id);
    this.summariesSignal.update((list) => list.filter((s) => s.id !== id));
    await this.search.remove(id);
  }

  private requireRoot(): FsDirectoryHandle {
    const root = this.workspace.root();
    if (!root) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    return root;
  }

  private async tasksDir(): Promise<FsDirectoryHandle> {
    return this.fs.getOrCreateDir(this.requireRoot(), TASKS_DIR);
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

  private async findFilename(dir: FsDirectoryHandle, id: string): Promise<string> {
    const cached = this.idToFile.get(id);
    if (cached) return cached;
    for await (const name of this.fs.listFiles(dir, TASK_FILE_SUFFIX)) {
      try {
        const raw = await this.fs.readJson<Task>(dir, name);
        if (raw.id === id) {
          this.idToFile.set(id, name);
          return name;
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
      const candidate = `${withSuffix(base, n)}${TASK_FILE_SUFFIX}`;
      const exists = await this.fs.hasEntry(dir, candidate);
      if (!exists) return candidate;
    }
    throw new AppError(ERROR_CODES.FS_001, {
      severity: 'error',
      context: { reason: 'slug exhaustion', base },
    });
  }

  private toSummary(task: Task): TaskSummary {
    return {
      id: task.id,
      title: task.title,
      done: task.done,
      dueDates: task.dueDates,
      updatedAt: task.updatedAt,
      tags: task.tags,
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

// why: pending tasks first, then by next due date (or updatedAt if none),
//      then done tasks at the bottom most-recently-completed first.
const compareSummaries = (a: TaskSummary, b: TaskSummary): number => {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (!a.done) {
    const aKey = a.dueDates[0] ?? `~${a.updatedAt}`;
    const bKey = b.dueDates[0] ?? `~${b.updatedAt}`;
    return aKey.localeCompare(bKey);
  }
  return b.updatedAt.localeCompare(a.updatedAt);
};

const sortSummaries = (list: readonly TaskSummary[]): readonly TaskSummary[] =>
  [...list].sort(compareSummaries);
