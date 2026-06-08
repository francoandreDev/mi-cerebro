import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FsService } from '@core/fs/fs.service';
import { FsStub, WorkspaceStub, makeDir } from '@core/fs/fs.stub';
import { WorkspaceService } from '@core/fs/workspace.service';
import { GoalsService } from '@features/goals/services/goals.service';
import { NotesService } from '@features/notes/services/notes.service';
import { TasksService } from '@features/tasks/services/tasks.service';

import { TrashService } from './trash.service';

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
      if (!cursor.dirs.has(part)) cursor.dirs.set(part, makeDir(part));
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
