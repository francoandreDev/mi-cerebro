import { Injectable, inject, signal } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { FsService } from '@core/fs/fs.service';
import type { FsDirectoryHandle } from '@core/fs/fs.types';
import { WorkspaceService } from '@core/fs/workspace.service';
import { GoalsService } from '@features/goals/services/goals.service';
import { ListsService } from '@features/lists/services/lists.service';
import { NotesService } from '@features/notes/services/notes.service';
import { TasksService } from '@features/tasks/services/tasks.service';
import { BooksService } from '@features/books/services/books.service';
import type { BookBundle } from '@features/books/models/book.types';
import { FilesService } from '@features/files/services/files.service';
import { COLLECTION_META_FILE } from '@features/files/models/file-collection.types';
import { GalleriesService } from '@features/images/services/galleries.service';
import { GALLERY_META_FILE } from '@core/images/image-paths';
import { RemindersService } from '@features/reminders/services/reminders.service';
import { WritingsService } from '@features/writings/services/writings.service';

import {
  KIND_DIRS,
  TRASH_FILE_SUFFIX,
  TRASH_META_DIR,
  TRASH_SUBDIR,
  type TrashEntry,
  type TrashKind,
} from './trash.types';

@Injectable({ providedIn: 'root' })
export class TrashService {
  private readonly fs = inject(FsService);
  private readonly workspace = inject(WorkspaceService);
  private readonly notes = inject(NotesService);
  private readonly tasks = inject(TasksService);
  private readonly goals = inject(GoalsService);
  private readonly lists = inject(ListsService);
  private readonly writings = inject(WritingsService);
  private readonly books = inject(BooksService);
  private readonly galleries = inject(GalleriesService);
  private readonly files = inject(FilesService);
  private readonly reminders = inject(RemindersService);

  private readonly entriesSignal = signal<readonly TrashEntry[]>([]);
  readonly entries = this.entriesSignal.asReadonly();

  async refresh(): Promise<readonly TrashEntry[]> {
    const trash = await this.trashRoot(true);
    if (!trash) {
      this.entriesSignal.set([]);
      return [];
    }
    const out: TrashEntry[] = [];
    for await (const yyyy of this.fs.listSubdirs(trash)) {
      const y = await this.fs.getDir(trash, yyyy);
      if (!y) continue;
      for await (const mm of this.fs.listSubdirs(y)) {
        const m = await this.fs.getDir(y, mm);
        if (!m) continue;
        for await (const dd of this.fs.listSubdirs(m)) {
          const d = await this.fs.getDir(m, dd);
          if (!d) continue;
          for await (const filename of this.fs.listFiles(d, TRASH_FILE_SUFFIX)) {
            const entry = await this.parseEntry(d, filename, [yyyy, mm, dd]);
            if (entry) out.push(entry);
          }
          for await (const subdir of this.fs.listSubdirs(d)) {
            const entry = await this.parseDirEntry(d, subdir, [yyyy, mm, dd]);
            if (entry) out.push(entry);
          }
        }
      }
    }
    out.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
    this.entriesSignal.set(out);
    return out;
  }

  async restore(entry: TrashEntry): Promise<void> {
    const root = this.requireRoot();
    const day = await this.dayDir(root, entry.parentPath);
    if (!day) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    if (entry.kind === 'book') {
      const bundle = await this.fs.readJson<BookBundle>(day, entry.filename);
      await this.books.restoreFromBundle(bundle);
      await this.fs.removeEntry(day, entry.filename);
      this.entriesSignal.update((list) => list.filter((e) => !sameEntry(e, entry)));
      return;
    }
    if (entry.kind === 'image') {
      await this.galleries.restoreFromDir(day, entry.filename);
      this.entriesSignal.update((list) => list.filter((e) => !sameEntry(e, entry)));
      return;
    }
    if (entry.kind === 'file') {
      await this.files.restoreFromDir(day, entry.filename);
      this.entriesSignal.update((list) => list.filter((e) => !sameEntry(e, entry)));
      return;
    }
    const target = await this.fs.getOrCreateDir(root, KIND_DIRS[entry.kind]);
    const original = this.stripPrefix(entry.filename, entry.kind, entry.id);
    const dest = await this.allocDest(target, original);
    await this.fs.moveFile(day, entry.filename, target, dest);
    this.entriesSignal.update((list) => list.filter((e) => !sameEntry(e, entry)));
    await this.refreshKind(entry.kind);
  }

  async purge(entry: TrashEntry): Promise<void> {
    const root = this.requireRoot();
    const day = await this.dayDir(root, entry.parentPath);
    if (!day) return;
    await this.fs.removeEntry(day, entry.filename, { recursive: entry.shape === 'directory' });
    this.entriesSignal.update((list) => list.filter((e) => !sameEntry(e, entry)));
  }

  async empty(): Promise<void> {
    const root = this.requireRoot();
    const meta = await this.fs.getDir(root, TRASH_META_DIR);
    if (!meta) return;
    if (!(await this.fs.hasEntry(meta, TRASH_SUBDIR))) return;
    await this.fs.removeEntry(meta, TRASH_SUBDIR, { recursive: true });
    this.entriesSignal.set([]);
  }

  private async refreshKind(kind: TrashKind): Promise<void> {
    if (kind === 'note') await this.notes.refresh();
    else if (kind === 'task') await this.tasks.refresh();
    else if (kind === 'goal') await this.goals.refresh();
    else if (kind === 'list') await this.lists.refresh();
    else if (kind === 'writing') await this.writings.refresh();
    else if (kind === 'book') await this.books.refresh();
    else if (kind === 'image') await this.galleries.refresh();
    else if (kind === 'reminder') await this.reminders.refresh();
    else await this.files.refresh();
  }

  private async parseEntry(
    day: FsDirectoryHandle,
    filename: string,
    parentPath: readonly string[],
  ): Promise<TrashEntry | null> {
    const stem = filename.endsWith(TRASH_FILE_SUFFIX)
      ? filename.slice(0, -TRASH_FILE_SUFFIX.length)
      : filename;
    const sep = stem.indexOf('__');
    if (sep < 0) return null;
    const kind = stem.slice(0, sep);
    if (
      kind !== 'note' &&
      kind !== 'task' &&
      kind !== 'goal' &&
      kind !== 'list' &&
      kind !== 'writing' &&
      kind !== 'book' &&
      kind !== 'reminder'
    ) {
      return null;
    }
    const rest = stem.slice(sep + 2);
    const sep2 = rest.indexOf('__');
    if (sep2 < 0) return null;
    const id = rest.slice(0, sep2);
    try {
      const raw = await this.fs.readJson<{ title?: string; book?: { title?: string } }>(
        day,
        filename,
      );
      return {
        filename,
        parentPath,
        id,
        kind: kind as TrashKind,
        title: raw.book?.title ?? raw.title ?? '',
        deletedAt: parentPath.join('-'),
        shape: 'file',
      };
    } catch {
      return null;
    }
  }

  private async parseDirEntry(
    day: FsDirectoryHandle,
    name: string,
    parentPath: readonly string[],
  ): Promise<TrashEntry | null> {
    const sep = name.indexOf('__');
    if (sep < 0) return null;
    const kind = name.slice(0, sep);
    if (kind !== 'image' && kind !== 'file') return null;
    const rest = name.slice(sep + 2);
    const sep2 = rest.indexOf('__');
    if (sep2 < 0) return null;
    const id = rest.slice(0, sep2);
    try {
      const dir = await this.fs.getDir(day, name);
      if (!dir) return null;
      const metaFile = kind === 'image' ? GALLERY_META_FILE : COLLECTION_META_FILE;
      const raw = await this.fs.readJson<{ title?: string }>(dir, metaFile);
      return {
        filename: name,
        parentPath,
        id,
        kind: kind as TrashKind,
        title: raw.title ?? '',
        deletedAt: parentPath.join('-'),
        shape: 'directory',
      };
    } catch {
      return null;
    }
  }

  private stripPrefix(filename: string, kind: TrashKind, id: string): string {
    const prefix = `${kind}__${id}__`;
    return filename.startsWith(prefix) ? filename.slice(prefix.length) : filename;
  }

  private async allocDest(dir: FsDirectoryHandle, name: string): Promise<string> {
    if (!(await this.fs.hasEntry(dir, name))) return name;
    const dot = name.lastIndexOf('.');
    const base = dot >= 0 ? name.slice(0, dot) : name;
    const ext = dot >= 0 ? name.slice(dot) : '';
    for (let n = 1; n < 1000; n++) {
      const candidate = `${base}-${n}${ext}`;
      if (!(await this.fs.hasEntry(dir, candidate))) return candidate;
    }
    throw new AppError(ERROR_CODES.FS_001, { severity: 'error' });
  }

  private async trashRoot(readOnly = false): Promise<FsDirectoryHandle | null> {
    const root = this.requireRoot();
    if (readOnly) {
      const meta = await this.fs.getDir(root, TRASH_META_DIR);
      if (!meta) return null;
      return this.fs.getDir(meta, TRASH_SUBDIR);
    }
    const meta = await this.fs.getOrCreateDir(root, TRASH_META_DIR);
    return this.fs.getOrCreateDir(meta, TRASH_SUBDIR);
  }

  private async dayDir(
    root: FsDirectoryHandle,
    path: readonly string[],
  ): Promise<FsDirectoryHandle | null> {
    let cursor: FsDirectoryHandle | null = await this.fs.getDir(root, TRASH_META_DIR);
    if (!cursor) return null;
    cursor = await this.fs.getDir(cursor, TRASH_SUBDIR);
    if (!cursor) return null;
    for (const part of path) {
      cursor = await this.fs.getDir(cursor, part);
      if (!cursor) return null;
    }
    return cursor;
  }

  private requireRoot(): FsDirectoryHandle {
    const root = this.workspace.root();
    if (!root) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    return root;
  }
}

const sameEntry = (a: TrashEntry, b: TrashEntry): boolean =>
  a.filename === b.filename && a.parentPath.join('/') === b.parentPath.join('/');
