import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { FsService } from '@core/fs/fs.service';
import type { FsDirectoryHandle } from '@core/fs/fs.types';
import { WorkspaceService } from '@core/fs/workspace.service';

import { RELATIONS_FILE } from './relation.types';
import { RelationsService } from './relations.service';

class InMemoryFs {
  files = new Map<string, string>();

  isSupported() {
    return true;
  }
  async hasEntry(_root: unknown, name: string) {
    return this.files.has(name);
  }
  async readJson<T>(_root: unknown, name: string): Promise<T> {
    const raw = this.files.get(name);
    if (!raw) throw new Error('not found');
    return JSON.parse(raw) as T;
  }
  async writeFileAtomic(_root: unknown, name: string, contents: string) {
    this.files.set(name, contents);
  }
}

class WorkspaceStub {
  root() {
    return {} as FsDirectoryHandle;
  }
}

const NOTE = { kind: 'note', id: 'reunion-estudio-contable' };
const GOAL = { kind: 'goal', id: 'cerrar-balance-semestre' };

describe('RelationsService', () => {
  let fs: InMemoryFs;

  beforeEach(() => {
    fs = new InMemoryFs();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: FsService, useValue: fs },
        { provide: WorkspaceService, useClass: WorkspaceStub },
      ],
    });
  });

  it('refreshes from empty workspace', async () => {
    const svc = TestBed.inject(RelationsService);
    const relations = await svc.refresh();
    expect(relations).toEqual([]);
  });

  it('creates a relation via create and persists relations.json', async () => {
    const svc = TestBed.inject(RelationsService);
    await svc.refresh();
    const relation = await svc.create({
      from: NOTE,
      to: GOAL,
      origin: 'editor',
      contextSnippet: 'cerrar el balance del semestre',
    });
    expect(relation.origin).toBe('editor');
    expect(fs.files.has(RELATIONS_FILE)).toBe(true);
    const parsed = JSON.parse(fs.files.get(RELATIONS_FILE)!);
    expect(parsed.relations).toHaveLength(1);
  });

  it('create is idempotent for the same from/to pair', async () => {
    const svc = TestBed.inject(RelationsService);
    await svc.refresh();
    const a = await svc.create({ from: NOTE, to: GOAL, origin: 'editor' });
    const b = await svc.create({ from: NOTE, to: GOAL, origin: 'manual' });
    expect(a.id).toBe(b.id);
    expect(svc.relations()).toHaveLength(1);
  });

  it('outgoingFor and backlinksFor resolve from opposite ends', async () => {
    const svc = TestBed.inject(RelationsService);
    await svc.refresh();
    await svc.create({ from: NOTE, to: GOAL, origin: 'editor' });

    expect(svc.outgoingFor(NOTE)).toHaveLength(1);
    expect(svc.outgoingFor(GOAL)).toHaveLength(0);
    expect(svc.backlinksFor(GOAL)).toHaveLength(1);
    expect(svc.backlinksFor(NOTE)).toHaveLength(0);
  });

  it('remove drops the relation from disk', async () => {
    const svc = TestBed.inject(RelationsService);
    await svc.refresh();
    const relation = await svc.create({ from: NOTE, to: GOAL, origin: 'manual' });
    await svc.remove(relation.id);
    expect(svc.relations()).toEqual([]);
    expect(svc.backlinksFor(GOAL)).toHaveLength(0);
  });

  it('remove is a no-op for an unknown id', async () => {
    const svc = TestBed.inject(RelationsService);
    await svc.refresh();
    await svc.create({ from: NOTE, to: GOAL, origin: 'manual' });
    await svc.remove('does-not-exist');
    expect(svc.relations()).toHaveLength(1);
  });

  it('reads back existing relations.json on refresh', async () => {
    fs.files.set(
      RELATIONS_FILE,
      JSON.stringify({
        schemaVersion: 1,
        relations: [
          {
            id: 'r1',
            from: NOTE,
            to: GOAL,
            origin: 'editor',
            createdAt: '2026-07-31T00:00:00Z',
          },
        ],
      }),
    );
    const svc = TestBed.inject(RelationsService);
    const relations = await svc.refresh();
    expect(relations).toHaveLength(1);
    expect(svc.backlinksFor(GOAL)).toHaveLength(1);
  });
});
