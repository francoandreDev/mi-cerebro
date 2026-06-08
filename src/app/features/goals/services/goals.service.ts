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
  GOAL_FILE_SUFFIX,
  GOAL_KIND,
  GOAL_SCHEMA_VERSION,
  GOALS_DIR,
  emptyDoc,
  type Goal,
  type GoalSummary,
} from '../models/goal.types';

const TRASH_DIR = '.mi-cerebro';
const TRASH_SUBDIR = 'trash';

@Injectable({ providedIn: 'root' })
export class GoalsService {
  private readonly fs = inject(FsService);
  private readonly workspace = inject(WorkspaceService);
  private readonly migrations = inject(MigrationsService);
  private readonly search = inject(SearchIndexService);
  private readonly tags = inject(TagsService);

  private readonly idToFile = new Map<string, string>();
  private readonly summariesSignal = signal<readonly GoalSummary[]>([]);
  readonly summaries = this.summariesSignal.asReadonly();

  constructor() {
    this.migrations.register({ kind: GOAL_KIND, latest: GOAL_SCHEMA_VERSION, steps: [] });
  }

  async refresh(): Promise<readonly GoalSummary[]> {
    const dir = await this.goalsDir();
    this.idToFile.clear();
    const summaries: GoalSummary[] = [];
    const indexDocs: SearchDoc[] = [];
    for await (const name of this.fs.listFiles(dir, GOAL_FILE_SUFFIX)) {
      try {
        const raw = await this.fs.readJson<Goal>(dir, name);
        const goal = await this.migrations.migrate<Goal>(GOAL_KIND, raw);
        this.idToFile.set(goal.id, name);
        summaries.push(this.toSummary(goal));
        indexDocs.push(this.toSearchDoc(goal));
      } catch (cause) {
        console.warn('[goals] skipped unreadable file', name, cause);
      }
    }
    summaries.sort(compareSummaries);
    this.summariesSignal.set(summaries);
    await this.search.rebuild(indexDocs);
    return summaries;
  }

  async create(title = ''): Promise<Goal> {
    const dir = await this.goalsDir();
    const now = new Date().toISOString();
    const goal: Goal = {
      id: crypto.randomUUID(),
      title,
      body: emptyDoc(),
      tags: [],
      deadline: null,
      completed: false,
      createdAt: now,
      updatedAt: now,
      schemaVersion: GOAL_SCHEMA_VERSION,
    };
    const filename = await this.allocFilename(dir, title);
    await this.fs.writeFileAtomic(dir, filename, JSON.stringify(goal, null, 2));
    this.idToFile.set(goal.id, filename);
    this.summariesSignal.update((list) => sortSummaries([this.toSummary(goal), ...list]));
    await this.search.upsert(this.toSearchDoc(goal));
    return goal;
  }

  async read(id: string): Promise<Goal> {
    const dir = await this.goalsDir();
    const name = await this.findFilename(dir, id);
    const raw = await this.fs.readJson<Goal>(dir, name);
    return this.migrations.migrate<Goal>(GOAL_KIND, raw);
  }

  async save(goal: Goal): Promise<Goal> {
    const dir = await this.goalsDir();
    const cleanTags = this.dropStaleTags(goal.tags);
    const updated: Goal = { ...goal, tags: cleanTags, updatedAt: new Date().toISOString() };
    const current = await this.findFilename(dir, goal.id);
    await this.fs.writeFileAtomic(dir, current, JSON.stringify(updated, null, 2));
    this.summariesSignal.update((list) =>
      sortSummaries(list.map((s) => (s.id === goal.id ? this.toSummary(updated) : s))),
    );
    await this.search.upsert(this.toSearchDoc(updated));
    return updated;
  }

  async deleteToTrash(id: string): Promise<void> {
    const root = this.requireRoot();
    const dir = await this.goalsDir();
    const name = await this.findFilename(dir, id);
    const trashDir = await this.trashDir(root);
    const dest = `${GOAL_KIND}__${id}__${name}`;
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

  private async findFilename(dir: FsDirectoryHandle, id: string): Promise<string> {
    const cached = this.idToFile.get(id);
    if (cached) return cached;
    for await (const name of this.fs.listFiles(dir, GOAL_FILE_SUFFIX)) {
      try {
        const raw = await this.fs.readJson<Goal>(dir, name);
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
      const candidate = `${withSuffix(base, n)}${GOAL_FILE_SUFFIX}`;
      const exists = await this.fs.hasEntry(dir, candidate);
      if (!exists) return candidate;
    }
    throw new AppError(ERROR_CODES.FS_001, {
      severity: 'error',
      context: { reason: 'slug exhaustion', base },
    });
  }

  private toSummary(goal: Goal): GoalSummary {
    return {
      id: goal.id,
      title: goal.title,
      deadline: goal.deadline,
      completed: goal.completed,
      updatedAt: goal.updatedAt,
      tags: goal.tags,
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
    return aKey.localeCompare(bKey);
  }
  return b.updatedAt.localeCompare(a.updatedAt);
};

const sortSummaries = (list: readonly GoalSummary[]): readonly GoalSummary[] =>
  [...list].sort(compareSummaries);
