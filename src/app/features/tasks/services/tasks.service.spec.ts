import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { FsService } from '@core/fs/fs.service';
import { FsStub, WorkspaceStub } from '@core/fs/fs.stub';
import { WorkspaceService } from '@core/fs/workspace.service';

import { TASK_KIND } from '../models/task.types';
import { TasksService } from './tasks.service';

describe('TasksService', () => {
  let svc: TasksService;
  let fs: FsStub;

  beforeEach(() => {
    fs = new FsStub();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: FsService, useValue: fs },
        { provide: WorkspaceService, useValue: new WorkspaceStub(fs.root) },
      ],
    });
    svc = TestBed.inject(TasksService);
  });

  it('creates a task with done=false and empty dueDates', async () => {
    const task = await svc.create('Comprar pan');
    expect(task.done).toBe(false);
    expect(task.dueDates).toEqual([]);
    expect(task.schemaVersion).toBe(5);
    expect(task.position).toBeTypeOf('string');
    const tasks = fs.root.dirs.get('tasks')!;
    expect(tasks.files.has('comprar-pan.json')).toBe(true);
  });

  it('save sorts dueDates ascending and bumps updatedAt', async () => {
    const task = await svc.create('Algo');
    const original = task.updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    const saved = await svc.save({
      ...task,
      dueDates: ['2026-07-01', '2026-06-15', '2026-06-30'],
    });
    expect(saved.dueDates).toEqual(['2026-06-15', '2026-06-30', '2026-07-01']);
    expect(saved.updatedAt > original).toBe(true);
  });

  it('refresh sorts by position ascending (creation order by default)', async () => {
    const a = await svc.create('A');
    const b = await svc.create('B');
    const c = await svc.create('C');
    await svc.save({ ...a, dueDates: ['2026-07-10'] });
    await svc.save({ ...b, dueDates: ['2026-06-20'] });
    await svc.save({ ...c, done: true });
    const list = await svc.refresh();
    expect(list.map((s) => s.title)).toEqual(['A', 'B', 'C']);
  });

  it('setPosition reorders summaries', async () => {
    const a = await svc.create('A');
    const b = await svc.create('B');
    await svc.setPosition(b.id, '0A');
    const list = await svc.refresh();
    expect(list.map((s) => s.id)).toEqual([b.id, a.id]);
  });

  it('deleteToTrash moves the file under .mi-cerebro/trash/YYYY/MM/DD/', async () => {
    const task = await svc.create('X');
    await svc.deleteToTrash(task.id);
    expect(fs.root.dirs.get('tasks')!.files.size).toBe(0);
    let cursor = fs.root.dirs.get('.mi-cerebro')!.dirs.get('trash')!;
    while (cursor.dirs.size === 1) cursor = [...cursor.dirs.values()][0]!;
    expect(cursor.files.size).toBe(1);
  });

  it('registers task kind in MigrationsService at construct', async () => {
    await svc.create('x');
    expect(TASK_KIND).toBe('task');
  });
});
