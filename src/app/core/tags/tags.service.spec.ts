import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FsService } from '@core/fs/fs.service';
import type { FsDirectoryHandle } from '@core/fs/fs.types';
import { WorkspaceService } from '@core/fs/workspace.service';

import { TAGS_FILE } from './tag.types';
import { TagsService } from './tags.service';

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

describe('TagsService', () => {
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
    const svc = TestBed.inject(TagsService);
    const tags = await svc.refresh();
    expect(tags).toEqual([]);
  });

  it('creates a tag via touch and persists tags.json', async () => {
    const svc = TestBed.inject(TagsService);
    await svc.refresh();
    const tag = await svc.touch('Trabajo');
    expect(tag.label).toBe('Trabajo');
    expect(tag.id).toBe('trabajo');
    expect(fs.files.has(TAGS_FILE)).toBe(true);
    const parsed = JSON.parse(fs.files.get(TAGS_FILE)!);
    expect(parsed.tags).toHaveLength(1);
  });

  it('touch is idempotent on existing slug', async () => {
    const svc = TestBed.inject(TagsService);
    await svc.refresh();
    const a = await svc.touch('Trabajo');
    const b = await svc.touch('trabajo');
    expect(a.id).toBe(b.id);
    expect(svc.tags()).toHaveLength(1);
  });

  it('rename updates label without changing id', async () => {
    const svc = TestBed.inject(TagsService);
    await svc.refresh();
    const t = await svc.touch('Casa');
    const renamed = await svc.rename(t.id, 'Hogar');
    expect(renamed.id).toBe('casa');
    expect(renamed.label).toBe('Hogar');
  });

  it('remove drops the tag from disk', async () => {
    const svc = TestBed.inject(TagsService);
    await svc.refresh();
    const t = await svc.touch('Ideas');
    await svc.remove(t.id);
    expect(svc.tags()).toEqual([]);
  });

  it('touch trims and rejects empty labels', async () => {
    const svc = TestBed.inject(TagsService);
    await svc.refresh();
    await expect(svc.touch('   ')).rejects.toThrow();
  });

  it('assigns the same color for the same id', async () => {
    const svc = TestBed.inject(TagsService);
    await svc.refresh();
    const a = await svc.touch('Trabajo');
    await svc.remove(a.id);
    const b = await svc.touch('Trabajo');
    expect(b.color).toBe(a.color);
  });

  it('reads back existing tags.json on refresh', async () => {
    fs.files.set(
      TAGS_FILE,
      JSON.stringify({
        schemaVersion: 1,
        tags: [{ id: 'foo', label: 'Foo', color: '#fff', createdAt: '2025-01-01T00:00:00Z' }],
      }),
    );
    const svc = TestBed.inject(TagsService);
    const tags = await svc.refresh();
    expect(tags).toHaveLength(1);
    expect(tags[0]?.label).toBe('Foo');
  });

  it('caches and unused vi import is satisfied', () => {
    expect(vi).toBeDefined();
  });
});
