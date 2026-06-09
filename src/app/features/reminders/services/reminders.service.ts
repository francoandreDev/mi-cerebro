import { Injectable, inject, signal } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { FsService } from '@core/fs/fs.service';
import type { FsDirectoryHandle } from '@core/fs/fs.types';
import { WorkspaceService } from '@core/fs/workspace.service';
import { MigrationsService } from '@core/migrations/migrations.service';

import {
  REMINDER_FILE_SUFFIX,
  REMINDER_KIND,
  REMINDER_SCHEMA_VERSION,
  REMINDERS_DIR,
  type Reminder,
  type ReminderSummary,
} from '../models/reminder.types';

const TRASH_DIR = '.mi-cerebro';
const TRASH_SUBDIR = 'trash';

@Injectable({ providedIn: 'root' })
export class RemindersService {
  private readonly fs = inject(FsService);
  private readonly workspace = inject(WorkspaceService);
  private readonly migrations = inject(MigrationsService);

  private readonly idToFile = new Map<string, string>();
  private readonly summariesSignal = signal<readonly ReminderSummary[]>([]);
  readonly summaries = this.summariesSignal.asReadonly();

  constructor() {
    this.migrations.register({ kind: REMINDER_KIND, latest: REMINDER_SCHEMA_VERSION, steps: [] });
  }

  async refresh(): Promise<readonly ReminderSummary[]> {
    const dir = await this.remindersDir();
    this.idToFile.clear();
    const summaries: ReminderSummary[] = [];
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind !== 'file' || !name.endsWith(REMINDER_FILE_SUFFIX)) continue;
      try {
        const raw = await this.fs.readJson<Reminder>(dir, name);
        const reminder = await this.migrations.migrate<Reminder>(REMINDER_KIND, raw);
        this.idToFile.set(reminder.id, name);
        summaries.push(this.toSummary(reminder));
      } catch (cause) {
        console.warn('[reminders] skipped unreadable file', name, cause);
      }
    }
    summaries.sort(compareSummaries);
    this.summariesSignal.set(summaries);
    return summaries;
  }

  async create(title = '', dueAt?: string): Promise<Reminder> {
    const dir = await this.remindersDir();
    const now = new Date().toISOString();
    const reminder: Reminder = {
      id: crypto.randomUUID(),
      title,
      dueAt: dueAt ?? defaultDueAt(),
      done: false,
      createdAt: now,
      updatedAt: now,
      schemaVersion: REMINDER_SCHEMA_VERSION,
    };
    const filename = `${reminder.id}${REMINDER_FILE_SUFFIX}`;
    await this.fs.writeFileAtomic(dir, filename, JSON.stringify(reminder, null, 2));
    this.idToFile.set(reminder.id, filename);
    this.summariesSignal.update((curr) => sortSummaries([this.toSummary(reminder), ...curr]));
    return reminder;
  }

  async read(id: string): Promise<Reminder> {
    const dir = await this.remindersDir();
    const filename = this.requireFilename(id);
    const raw = await this.fs.readJson<Reminder>(dir, filename);
    return this.migrations.migrate<Reminder>(REMINDER_KIND, raw);
  }

  async save(reminder: Reminder): Promise<Reminder> {
    const dir = await this.remindersDir();
    const filename = this.requireFilename(reminder.id);
    const updated: Reminder = { ...reminder, updatedAt: new Date().toISOString() };
    await this.fs.writeFileAtomic(dir, filename, JSON.stringify(updated, null, 2));
    this.summariesSignal.update((curr) =>
      sortSummaries(curr.map((s) => (s.id === reminder.id ? this.toSummary(updated) : s))),
    );
    return updated;
  }

  async deleteToTrash(id: string): Promise<void> {
    const root = this.requireRoot();
    const dir = await this.remindersDir();
    const filename = this.requireFilename(id);
    const trashDir = await this.trashDir(root);
    const dest = `${REMINDER_KIND}__${id}__${filename}`;
    await this.fs.moveFile(dir, filename, trashDir, dest);
    this.idToFile.delete(id);
    this.summariesSignal.update((curr) => curr.filter((s) => s.id !== id));
  }

  setKnownFilename(id: string, filename: string): void {
    this.idToFile.set(id, filename);
  }

  private requireFilename(id: string): string {
    const f = this.idToFile.get(id);
    if (!f) throw new AppError(ERROR_CODES.FS_003, { severity: 'error', context: { id } });
    return f;
  }

  private requireRoot(): FsDirectoryHandle {
    const root = this.workspace.root();
    if (!root) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    return root;
  }

  private async remindersDir(): Promise<FsDirectoryHandle> {
    return this.fs.getOrCreateDir(this.requireRoot(), REMINDERS_DIR);
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

  private toSummary(r: Reminder): ReminderSummary {
    return {
      id: r.id,
      title: r.title,
      dueAt: r.dueAt,
      done: r.done,
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
