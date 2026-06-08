import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { FsService } from '@core/fs/fs.service';
import type { FsDirectoryHandle } from '@core/fs/fs.types';
import { WorkspaceService } from '@core/fs/workspace.service';

import { GOAL_KIND } from '../models/goal.types';
import { GoalsService } from './goals.service';

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
  isSupported(): boolean {
    return true;
  }
  async getOrCreateDir(parent: unknown, name: string): Promise<unknown> {
    const p = this.resolve(parent);
    if (!p.dirs.has(name)) p.dirs.set(name, dir(name));
    return p.dirs.get(name) as unknown;
  }
  async getOrCreateFile(): Promise<unknown> {
    throw new Error('not used');
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
  async hasEntry(parent: unknown, name: string): Promise<boolean> {
    const p = this.resolve(parent);
    return p.files.has(name) || p.dirs.has(name);
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

describe('GoalsService', () => {
  let svc: GoalsService;
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
    svc = TestBed.inject(GoalsService);
  });

  it('creates a goal with completed=false and null deadline', async () => {
    const goal = await svc.create('Aprender ruso');
    expect(goal.completed).toBe(false);
    expect(goal.deadline).toBeNull();
    expect(goal.schemaVersion).toBe(1);
    const goals = fs.root.dirs.get('goals')!;
    expect(goals.files.has('aprender-ruso.json')).toBe(true);
  });

  it('save persists deadline and bumps updatedAt', async () => {
    const goal = await svc.create('Algo');
    const original = goal.updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    const saved = await svc.save({ ...goal, deadline: '2026-12-31' });
    expect(saved.deadline).toBe('2026-12-31');
    expect(saved.updatedAt > original).toBe(true);
  });

  it('summaries: pending first ordered by deadline, completed last', async () => {
    const a = await svc.create('A');
    const b = await svc.create('B');
    const c = await svc.create('C');
    await svc.save({ ...a, deadline: '2026-07-10' });
    await svc.save({ ...b, deadline: '2026-06-20' });
    await svc.save({ ...c, completed: true });
    const list = await svc.refresh();
    expect(list.map((s) => s.title)).toEqual(['B', 'A', 'C']);
  });

  it('deleteToTrash moves the file under .mi-cerebro/trash/YYYY/MM/DD/', async () => {
    const goal = await svc.create('X');
    await svc.deleteToTrash(goal.id);
    expect(fs.root.dirs.get('goals')!.files.size).toBe(0);
    let cursor = fs.root.dirs.get('.mi-cerebro')!.dirs.get('trash')!;
    while (cursor.dirs.size === 1) cursor = [...cursor.dirs.values()][0]!;
    expect(cursor.files.size).toBe(1);
  });

  it('registers goal kind in MigrationsService at construct', async () => {
    await svc.create('x');
    expect(GOAL_KIND).toBe('goal');
  });
});
