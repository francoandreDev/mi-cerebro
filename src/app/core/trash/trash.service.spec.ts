import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FsService } from '@core/fs/fs.service';
import type { FsDirectoryHandle } from '@core/fs/fs.types';
import { WorkspaceService } from '@core/fs/workspace.service';
import { GoalsService } from '@features/goals/services/goals.service';
import { NotesService } from '@features/notes/services/notes.service';
import { TasksService } from '@features/tasks/services/tasks.service';

import { TrashService } from './trash.service';

interface InMemoryDir {
  readonly name: string;
  readonly files: Map<string, string>;
  readonly dirs: Map<string, InMemoryDir>;
}

const dir = (name: string): InMemoryDir => ({
  name,
  files: new Map(),
  dirs: new Map(),
});

class FsStub {
  readonly root = dir('mc');
  private resolve(handle: unknown): InMemoryDir {
    return handle as unknown as InMemoryDir;
  }
  async getOrCreateDir(parent: unknown, name: string): Promise<unknown> {
    const p = this.resolve(parent);
    if (!p.dirs.has(name)) p.dirs.set(name, dir(name));
    return p.dirs.get(name) as unknown;
  }
  async getDir(parent: unknown, name: string): Promise<unknown> {
    const p = this.resolve(parent);
    return p.dirs.get(name) ?? null;
  }
  async writeFileAtomic(parent: unknown, name: string, contents: string): Promise<void> {
    this.resolve(parent).files.set(name, contents);
  }
  async readJson<T>(parent: unknown, name: string): Promise<T> {
    const text = this.resolve(parent).files.get(name);
    if (!text) throw new Error(`missing ${name}`);
    return JSON.parse(text) as T;
  }
  async *listFiles(parent: unknown, suffix?: string): AsyncIterable<string> {
    for (const name of this.resolve(parent).files.keys()) {
      if (suffix && !name.endsWith(suffix)) continue;
      yield name;
    }
  }
  async *listSubdirs(parent: unknown): AsyncIterable<string> {
    for (const name of this.resolve(parent).dirs.keys()) yield name;
  }
  async hasEntry(parent: unknown, name: string): Promise<boolean> {
    const p = this.resolve(parent);
    return p.files.has(name) || p.dirs.has(name);
  }
  async removeEntry(
    parent: unknown,
    name: string,
    options: { recursive?: boolean } = {},
  ): Promise<void> {
    const p = this.resolve(parent);
    if (p.files.delete(name)) return;
    const d = p.dirs.get(name);
    if (!d) return;
    if (!options.recursive && (d.files.size > 0 || d.dirs.size > 0)) {
      throw new Error('not empty');
    }
    p.dirs.delete(name);
  }
  async moveFile(
    parent: unknown,
    name: string,
    destParent: unknown,
    destName?: string,
  ): Promise<void> {
    const src = this.resolve(parent);
    const dst = this.resolve(destParent);
    const contents = src.files.get(name);
    if (contents === undefined) throw new Error(`missing ${name}`);
    src.files.delete(name);
    dst.files.set(destName ?? name, contents);
  }
}

class WorkspaceStub {
  constructor(private readonly handle: unknown) {}
  root(): FsDirectoryHandle {
    return this.handle as FsDirectoryHandle;
  }
}

const stubService = () => ({ refresh: vi.fn().mockResolvedValue([]) });

describe('TrashService', () => {
  let svc: TrashService;
  let fs: FsStub;
  let notes: { refresh: ReturnType<typeof vi.fn> };
  let tasks: { refresh: ReturnType<typeof vi.fn> };
  let goals: { refresh: ReturnType<typeof vi.fn> };

  const seedTrashFile = (
    yyyy: string,
    mm: string,
    dd: string,
    filename: string,
    body: object,
  ): void => {
    let cursor = fs.root;
    for (const part of ['.mi-cerebro', 'trash', yyyy, mm, dd]) {
      if (!cursor.dirs.has(part)) cursor.dirs.set(part, dir(part));
      cursor = cursor.dirs.get(part)!;
    }
    cursor.files.set(filename, JSON.stringify(body));
  };

  beforeEach(() => {
    fs = new FsStub();
    notes = stubService();
    tasks = stubService();
    goals = stubService();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: FsService, useValue: fs },
        { provide: WorkspaceService, useValue: new WorkspaceStub(fs.root) },
        { provide: NotesService, useValue: notes },
        { provide: TasksService, useValue: tasks },
        { provide: GoalsService, useValue: goals },
      ],
    });
    svc = TestBed.inject(TrashService);
  });

  it('lists entries from all kinds with kind/id parsed from filename', async () => {
    seedTrashFile('2026', '06', '08', 'note__abc__hello.json', { title: 'Hello' });
    seedTrashFile('2026', '06', '07', 'task__xyz__do-stuff.json', { title: 'Do stuff' });
    seedTrashFile('2026', '06', '08', 'goal__ggg__win.json', { title: 'Win' });
    const list = await svc.refresh();
    expect(list).toHaveLength(3);
    const byKind = Object.fromEntries(list.map((e) => [e.kind, e]));
    expect(byKind['note']!.id).toBe('abc');
    expect(byKind['note']!.title).toBe('Hello');
    expect(byKind['task']!.id).toBe('xyz');
    expect(byKind['goal']!.id).toBe('ggg');
  });

  it('refresh returns empty when trash dir does not exist', async () => {
    const list = await svc.refresh();
    expect(list).toEqual([]);
  });

  it('restore moves file to kind dir, strips prefix, refreshes kind', async () => {
    seedTrashFile('2026', '06', '08', 'note__abc__hello.json', { title: 'Hello' });
    const list = await svc.refresh();
    await svc.restore(list[0]!);
    expect(fs.root.dirs.get('notes')!.files.has('hello.json')).toBe(true);
    expect(notes.refresh).toHaveBeenCalled();
    expect(svc.entries()).toEqual([]);
  });

  it('purge removes file without refreshing entity', async () => {
    seedTrashFile('2026', '06', '08', 'note__abc__hello.json', { title: 'Hello' });
    const list = await svc.refresh();
    await svc.purge(list[0]!);
    const day = fs.root.dirs
      .get('.mi-cerebro')!
      .dirs.get('trash')!
      .dirs.get('2026')!
      .dirs.get('06')!
      .dirs.get('08')!;
    expect(day.files.size).toBe(0);
    expect(notes.refresh).not.toHaveBeenCalled();
  });

  it('empty removes the whole trash subdir recursively', async () => {
    seedTrashFile('2026', '06', '08', 'note__abc__a.json', { title: 'A' });
    seedTrashFile('2026', '06', '07', 'task__xyz__b.json', { title: 'B' });
    await svc.refresh();
    await svc.empty();
    expect(fs.root.dirs.get('.mi-cerebro')!.dirs.has('trash')).toBe(false);
    expect(svc.entries()).toEqual([]);
  });
});
