import { Injectable, inject, signal } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { FsService } from '@core/fs/fs.service';
import type { FsDirectoryHandle } from '@core/fs/fs.types';
import { WorkspaceService } from '@core/fs/workspace.service';
import { MigrationsService } from '@core/migrations/migrations.service';
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

  // why: read(id) and save(note) both need the on-disk filename; we cache
  //      it on first list/load so callers don't pay an O(N) scan each time.
  private readonly idToFile = new Map<string, string>();
  private readonly summariesSignal = signal<readonly NoteSummary[]>([]);
  readonly summaries = this.summariesSignal.asReadonly();

  constructor() {
    // why: no steps yet — first bump comes when the Note shape changes.
    this.migrations.register({ kind: NOTE_KIND, latest: NOTE_SCHEMA_VERSION, steps: [] });
  }

  async refresh(): Promise<readonly NoteSummary[]> {
    const dir = await this.notesDir();
    this.idToFile.clear();
    const summaries: NoteSummary[] = [];
    for await (const name of this.fs.listFiles(dir, NOTE_FILE_SUFFIX)) {
      try {
        const raw = await this.fs.readJson<Note>(dir, name);
        const note = await this.migrations.migrate<Note>(NOTE_KIND, raw);
        this.idToFile.set(note.id, name);
        summaries.push({ id: note.id, title: note.title, updatedAt: note.updatedAt });
      } catch (cause) {
        // why: a single corrupt file shouldn't blank the whole list.
        console.warn('[notes] skipped unreadable file', name, cause);
      }
    }
    summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    this.summariesSignal.set(summaries);
    return summaries;
  }

  async create(title = ''): Promise<Note> {
    const dir = await this.notesDir();
    const now = new Date().toISOString();
    const note: Note = {
      id: crypto.randomUUID(),
      title,
      body: emptyDoc(),
      tags: [],
      createdAt: now,
      updatedAt: now,
      schemaVersion: NOTE_SCHEMA_VERSION,
    };
    const filename = await this.allocFilename(dir, title);
    await this.fs.writeFileAtomic(dir, filename, JSON.stringify(note, null, 2));
    this.idToFile.set(note.id, filename);
    this.summariesSignal.update((list) => [this.toSummary(note), ...list]);
    return note;
  }

  async read(id: string): Promise<Note> {
    const dir = await this.notesDir();
    const name = await this.findFilename(dir, id);
    const raw = await this.fs.readJson<Note>(dir, name);
    return this.migrations.migrate<Note>(NOTE_KIND, raw);
  }

  async save(note: Note): Promise<Note> {
    const dir = await this.notesDir();
    const updated: Note = { ...note, updatedAt: new Date().toISOString() };
    const current = await this.findFilename(dir, note.id);
    await this.fs.writeFileAtomic(dir, current, JSON.stringify(updated, null, 2));
    this.summariesSignal.update((list) =>
      list.map((s) => (s.id === note.id ? this.toSummary(updated) : s)),
    );
    return updated;
  }

  async deleteToTrash(id: string): Promise<void> {
    const root = this.requireRoot();
    const dir = await this.notesDir();
    const name = await this.findFilename(dir, id);
    const trashDir = await this.trashDir(root);
    const dest = `${id}__${name}`;
    await this.fs.moveFile(dir, name, trashDir, dest);
    this.idToFile.delete(id);
    this.summariesSignal.update((list) => list.filter((s) => s.id !== id));
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

  private async findFilename(dir: FsDirectoryHandle, id: string): Promise<string> {
    const cached = this.idToFile.get(id);
    if (cached) return cached;
    for await (const name of this.fs.listFiles(dir, NOTE_FILE_SUFFIX)) {
      try {
        const raw = await this.fs.readJson<Note>(dir, name);
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
      const candidate = `${withSuffix(base, n)}${NOTE_FILE_SUFFIX}`;
      const exists = await this.fs.hasEntry(dir, candidate);
      if (!exists) return candidate;
    }
    throw new AppError(ERROR_CODES.FS_001, {
      severity: 'error',
      context: { reason: 'slug exhaustion', base },
    });
  }

  private toSummary(note: Note): NoteSummary {
    return { id: note.id, title: note.title, updatedAt: note.updatedAt };
  }
}
