import { Injectable, computed, inject, signal } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { ErrorService } from '@core/errors/error.service';
import { FsService } from '@core/fs/fs.service';
import type { NativeDirRef } from '@core/fs/native-fs.types';
import { WorkspaceService } from '@core/fs/workspace.service';
import { MigrationsService } from '@core/migrations/migrations.service';
import { SearchIndexService } from '@core/search/search-index.service';
import type { SearchDoc } from '@core/search/search.types';
import { TagsService } from '@core/tags/tags.service';

import {
  REMINDER_FILE_SUFFIX,
  REMINDER_KIND,
  REMINDER_SCHEMA_VERSION,
  REMINDERS_DIR,
  type Recurrence,
  type Reminder,
  type ReminderSourceKind,
  type ReminderSummary,
} from '../models/reminder.types';
import { bucketOf } from '../utils/buckets';
import { reminderCadenceMigrationStep } from './reminder-cadence.migration';
import { reminderNoteMigrationStep } from './reminder-note.migration';
import { reminderRecurrenceMigrationStep } from './reminder-recurrence.migration';
import { reminderSourceMigrationStep } from './reminder-source.migration';
import { reminderTagsMigrationStep } from './reminder-tags.migration';

const TRASH_DIR = '.mi-cerebro';
const TRASH_SUBDIR = 'trash';

@Injectable({ providedIn: 'root' })
export class RemindersService {
  private readonly fs = inject(FsService);
  private readonly workspace = inject(WorkspaceService);
  private readonly migrations = inject(MigrationsService);
  private readonly errors = inject(ErrorService);
  private readonly search = inject(SearchIndexService);
  private readonly tags = inject(TagsService);

  private readonly idToFile = new Map<string, string>();
  private readonly summariesSignal = signal<readonly ReminderSummary[]>([]);
  readonly summaries = this.summariesSignal.asReadonly();

  // why: drives the overdue badge on the rail — a plain count so the
  //      sidebar doesn't need to know about buckets or dates.
  readonly overdueCount = computed(
    () => this.summaries().filter((r) => bucketOf(r) === 'overdue').length,
  );

  // why: the FileSystemFileHandle API locks while a writable is open, so
  //      concurrent saves to the same file from cadence-sync, goal-sync,
  //      and user edits collide ("cannot be moved while it is locked").
  //      It also lets a refresh race with an in-flight create and yield
  //      duplicate-key summaries. A single FS-mutation gate serializes
  //      everything that touches reminder files.
  private fsQueue: Promise<unknown> = Promise.resolve();

  private gate<T>(run: () => Promise<T>): Promise<T> {
    const next = this.fsQueue.then(run, run);
    this.fsQueue = next.catch(() => undefined);
    return next;
  }

  constructor() {
    this.migrations.register({
      kind: REMINDER_KIND,
      latest: REMINDER_SCHEMA_VERSION,
      steps: [
        reminderSourceMigrationStep(1),
        reminderCadenceMigrationStep(2),
        reminderRecurrenceMigrationStep(3),
        reminderTagsMigrationStep(4),
        reminderNoteMigrationStep(5),
      ],
    });
  }

  async refresh(): Promise<readonly ReminderSummary[]> {
    return this.gate(() => this.refreshLocked());
  }

  private async refreshLocked(): Promise<readonly ReminderSummary[]> {
    const dir = await this.remindersDir();
    this.idToFile.clear();
    const summaries: ReminderSummary[] = [];
    const indexDocs: SearchDoc[] = [];
    let skipped = 0;
    for await (const name of this.fs.listFiles(dir, REMINDER_FILE_SUFFIX)) {
      try {
        const raw = await this.fs.readJson<Reminder>(dir, name);
        const reminder = await this.migrations.migrate<Reminder>(REMINDER_KIND, raw);
        this.idToFile.set(reminder.id, name);
        summaries.push(this.toSummary(reminder));
        indexDocs.push(this.toSearchDoc(reminder));
      } catch (cause) {
        const dropped = await this.dropIfEmpty(dir, name, cause);
        if (!dropped) skipped++;
      }
    }
    this.errors.reportSkippedEntries(skipped, { area: 'reminders' });
    summaries.sort(compareSummaries);
    this.summariesSignal.set(summaries);
    await this.search.rebuildKind(REMINDER_KIND, indexDocs);
    return summaries;
  }

  async create(
    title = '',
    dueAt?: string,
    source?: { kind: ReminderSourceKind; id: string },
    options?: { recurrence?: Recurrence | null; paused?: boolean },
  ): Promise<Reminder> {
    return this.gate(() => this.createLocked(title, dueAt, source, options));
  }

  private async createLocked(
    title: string,
    dueAt: string | undefined,
    source: { kind: ReminderSourceKind; id: string } | undefined,
    options: { recurrence?: Recurrence | null; paused?: boolean } | undefined,
  ): Promise<Reminder> {
    const dir = await this.remindersDir();
    const now = new Date().toISOString();
    const target = dueAt ?? defaultDueAt();
    const reminder: Reminder = {
      id: crypto.randomUUID(),
      title,
      dueAt: target,
      // why: seed nextPingAt to the target so the reminder fires at least
      //      once even before the cadence service first runs. The cadence
      //      effect will overwrite this with the pre-deadline lead-up slot
      //      on its next tick.
      nextPingAt: target,
      done: false,
      paused: options?.paused ?? false,
      recurrence: options?.recurrence ?? null,
      sourceKind: source?.kind ?? null,
      sourceId: source?.id ?? null,
      tags: [],
      note: '',
      createdAt: now,
      updatedAt: now,
      schemaVersion: REMINDER_SCHEMA_VERSION,
    };
    const filename = `${reminder.id}${REMINDER_FILE_SUFFIX}`;
    await this.fs.writeFileAtomic(dir, filename, JSON.stringify(reminder, null, 2));
    this.idToFile.set(reminder.id, filename);
    this.summariesSignal.update((curr) => sortSummaries([this.toSummary(reminder), ...curr]));
    await this.search.upsert(this.toSearchDoc(reminder));
    return reminder;
  }

  async read(id: string): Promise<Reminder> {
    return this.gate(async () => {
      const dir = await this.remindersDir();
      const filename = this.requireFilename(id);
      const raw = await this.fs.readJson<Reminder>(dir, filename);
      return this.migrations.migrate<Reminder>(REMINDER_KIND, raw);
    });
  }

  async save(reminder: Reminder): Promise<Reminder> {
    return this.gate(() => this.saveLocked(reminder));
  }

  private async saveLocked(reminder: Reminder): Promise<Reminder> {
    const dir = await this.remindersDir();
    const filename = this.requireFilename(reminder.id);
    const updated: Reminder = { ...reminder, updatedAt: new Date().toISOString() };
    await this.fs.writeFileAtomic(dir, filename, JSON.stringify(updated, null, 2));
    this.summariesSignal.update((curr) =>
      sortSummaries(curr.map((s) => (s.id === reminder.id ? this.toSummary(updated) : s))),
    );
    await this.search.upsert(this.toSearchDoc(updated));
    return updated;
  }

  async restore(reminder: Reminder): Promise<Reminder> {
    return this.gate(async () => {
      const dir = await this.remindersDir();
      const filename = `${reminder.id}${REMINDER_FILE_SUFFIX}`;
      await this.fs.writeFileAtomic(dir, filename, JSON.stringify(reminder, null, 2));
      this.idToFile.set(reminder.id, filename);
      this.summariesSignal.update((curr) => sortSummaries([this.toSummary(reminder), ...curr]));
      await this.search.upsert(this.toSearchDoc(reminder));
      return reminder;
    });
  }

  async deleteToTrash(id: string): Promise<void> {
    return this.gate(() => this.deleteToTrashLocked(id));
  }

  private async deleteToTrashLocked(id: string): Promise<void> {
    const root = this.requireRoot();
    const dir = await this.remindersDir();
    const filename = this.requireFilename(id);
    const trashDir = await this.trashDir(root);
    const dest = `${REMINDER_KIND}__${id}__${filename}`;
    await this.fs.moveFile(dir, filename, trashDir, dest);
    this.idToFile.delete(id);
    this.summariesSignal.update((curr) => curr.filter((s) => s.id !== id));
    await this.search.remove(id);
  }

  // why: zero-byte JSONs come from aborted writes and can't be parsed —
  //      drop them on refresh so the dir stays clean. Returns true when
  //      silently dropped (empty garbage, nothing lost), false when it's a
  //      genuine skip the caller should count towards the aggregated
  //      skipped-entries toast (rule 28).
  private async dropIfEmpty(dir: NativeDirRef, filename: string, cause: unknown): Promise<boolean> {
    const size = await this.fs.fileSize(dir, filename);
    if (size === 0) {
      try {
        await this.fs.removeEntry(dir, filename);
        console.info('[reminders] dropped empty file', filename);
        return true;
      } catch {
        /* fall through to warn */
      }
    }
    console.warn('[reminders] skipped unreadable file', filename, cause);
    return false;
  }

  setKnownFilename(id: string, filename: string): void {
    this.idToFile.set(id, filename);
  }

  private requireFilename(id: string): string {
    const f = this.idToFile.get(id);
    if (!f) throw new AppError(ERROR_CODES.FS_003, { severity: 'error', context: { id } });
    return f;
  }

  private requireRoot(): NativeDirRef {
    const root = this.workspace.root();
    if (!root) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    return root;
  }

  private async remindersDir(): Promise<NativeDirRef> {
    return this.fs.getOrCreateDir(this.requireRoot(), REMINDERS_DIR);
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

  private toSearchDoc(r: Reminder): SearchDoc {
    const tagLabels = r.tags
      .map((id) => this.tags.byId(id)?.label ?? '')
      .filter((l) => l !== '')
      .join(' ');
    return {
      id: r.id,
      kind: REMINDER_KIND,
      title: r.title,
      body: tagLabels,
      tagIds: r.tags,
    };
  }

  private toSummary(r: Reminder): ReminderSummary {
    return {
      id: r.id,
      title: r.title,
      dueAt: r.dueAt,
      nextPingAt: r.nextPingAt ?? r.dueAt,
      done: r.done,
      paused: r.paused ?? false,
      recurrence: r.recurrence ?? null,
      sourceKind: r.sourceKind ?? null,
      sourceId: r.sourceId ?? null,
      tags: r.tags ?? [],
      note: r.note ?? '',
      updatedAt: r.updatedAt,
    };
  }
}

const defaultDueAt = (): string => {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// why: pending earliest-first, then done items by latest updated.
const compareSummaries = (a: ReminderSummary, b: ReminderSummary): number => {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (!a.done) return a.dueAt.localeCompare(b.dueAt);
  return b.updatedAt.localeCompare(a.updatedAt);
};

const sortSummaries = (summaries: readonly ReminderSummary[]): readonly ReminderSummary[] =>
  [...summaries].sort(compareSummaries);
