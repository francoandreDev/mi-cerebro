import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { BooksService } from '@features/books/services/books.service';
import { FilesService } from '@features/files/services/files.service';
import { GoalsService } from '@features/goals/services/goals.service';
import { GalleriesService } from '@features/images/services/galleries.service';
import { ListsService } from '@features/lists/services/lists.service';
import { MusicLibraryService } from '@features/music/services/music-library.service';
import { PlaylistsService } from '@features/music/services/playlists.service';
import { NotesService } from '@features/notes/services/notes.service';
import { TasksService } from '@features/tasks/services/tasks.service';
import { WritingsService } from '@features/writings/services/writings.service';

import { TagsAdminService } from './tags-admin.service';
import { TagsService } from './tags.service';

// why: TagsAdminService only ever calls .summaries()/.read()/.save() (or the
// per-kind read*/save* variants) on each of the 8 entity services, so a thin
// in-memory fake covers the contract without pulling in real FS/IDB plumbing.
class FakeEntityService<T extends { id: string; tags: readonly string[] }> {
  private store = new Map<string, T>();
  summaries = signal<readonly T[]>([]);

  seed(entities: readonly T[]): void {
    this.store = new Map(entities.map((e) => [e.id, e]));
    this.summaries.set(entities);
  }

  async read(id: string): Promise<T> {
    const found = this.store.get(id);
    if (!found) throw new Error('not found');
    return found;
  }

  async save(entity: T): Promise<T> {
    this.store.set(entity.id, entity);
    this.summaries.set([...this.store.values()]);
    return entity;
  }

  // books/images/files use readX/saveX names — same behavior, different name.
  readBook = this.read.bind(this);
  saveBook = this.save.bind(this);
  readGallery = this.read.bind(this);
  saveGallery = this.save.bind(this);
  readCollection = this.read.bind(this);
  saveCollection = this.save.bind(this);
}

interface Entity {
  readonly id: string;
  readonly tags: readonly string[];
}

// why: MusicLibraryService exposes tracks as a `tracks` signal + `setTrackTags`
//      instead of the read/save pair every other entity service uses.
class FakeMusicLibraryService {
  tracks = signal<readonly Entity[]>([]);

  seed(entities: readonly Entity[]): void {
    this.tracks.set(entities);
  }

  async setTrackTags(id: string, tags: readonly string[]): Promise<void> {
    this.tracks.update((curr) => curr.map((t) => (t.id === id ? { ...t, tags } : t)));
  }
}

describe('TagsAdminService', () => {
  let notes: FakeEntityService<Entity>;
  let tasks: FakeEntityService<Entity>;
  let goals: FakeEntityService<Entity>;
  let lists: FakeEntityService<Entity>;
  let writings: FakeEntityService<Entity>;
  let books: FakeEntityService<Entity>;
  let galleries: FakeEntityService<Entity>;
  let files: FakeEntityService<Entity>;
  let tracks: FakeMusicLibraryService;
  let playlists: FakeEntityService<Entity>;
  let tagsService: { remove: (id: string) => Promise<void>; removed: string[] };

  beforeEach(() => {
    notes = new FakeEntityService();
    tasks = new FakeEntityService();
    goals = new FakeEntityService();
    lists = new FakeEntityService();
    writings = new FakeEntityService();
    books = new FakeEntityService();
    galleries = new FakeEntityService();
    files = new FakeEntityService();
    tracks = new FakeMusicLibraryService();
    playlists = new FakeEntityService();
    const removed: string[] = [];
    tagsService = {
      removed,
      remove: async (id: string) => {
        removed.push(id);
      },
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: NotesService, useValue: notes },
        { provide: TasksService, useValue: tasks },
        { provide: GoalsService, useValue: goals },
        { provide: ListsService, useValue: lists },
        { provide: WritingsService, useValue: writings },
        { provide: BooksService, useValue: books },
        { provide: GalleriesService, useValue: galleries },
        { provide: FilesService, useValue: files },
        { provide: MusicLibraryService, useValue: tracks },
        { provide: PlaylistsService, useValue: playlists },
        { provide: TagsService, useValue: tagsService },
      ],
    });
  });

  it('counts usage across every kind', () => {
    notes.seed([{ id: 'n1', tags: ['work'] }]);
    tasks.seed([
      { id: 't1', tags: ['work', 'urgent'] },
      { id: 't2', tags: ['urgent'] },
    ]);
    const admin = TestBed.inject(TagsAdminService);
    expect(admin.usageCount('work')).toBe(2);
    expect(admin.usageCount('urgent')).toBe(2);
    expect(admin.usageCount('unused')).toBe(0);
  });

  it('merge rewrites tag ids across every kind and removes the source from the registry', async () => {
    notes.seed([{ id: 'n1', tags: ['old', 'keep'] }]);
    tasks.seed([{ id: 't1', tags: ['old'] }]);
    const admin = TestBed.inject(TagsAdminService);

    await admin.merge('old', 'new');

    expect((await notes.read('n1')).tags).toEqual(['new', 'keep']);
    expect((await tasks.read('t1')).tags).toEqual(['new']);
    expect(tagsService.removed).toEqual(['old']);
  });

  it('merge dedupes when the target tag is already present', async () => {
    notes.seed([{ id: 'n1', tags: ['old', 'new'] }]);
    const admin = TestBed.inject(TagsAdminService);

    await admin.merge('old', 'new');

    expect((await notes.read('n1')).tags).toEqual(['new']);
  });

  it('merge is a no-op when merging a tag into itself', async () => {
    notes.seed([{ id: 'n1', tags: ['same'] }]);
    const admin = TestBed.inject(TagsAdminService);

    await admin.merge('same', 'same');

    expect((await notes.read('n1')).tags).toEqual(['same']);
    expect(tagsService.removed).toEqual([]);
  });

  it('deleteCascade removes the registry entry before re-saving affected entities', async () => {
    const saveOrder: string[] = [];
    notes.seed([{ id: 'n1', tags: ['gone', 'keep'] }]);
    const originalSave = notes.save.bind(notes);
    notes.save = async (entity) => {
      saveOrder.push('save');
      return originalSave(entity);
    };
    tagsService.remove = async (id: string) => {
      saveOrder.push('remove');
      tagsService.removed.push(id);
    };
    const admin = TestBed.inject(TagsAdminService);

    await admin.deleteCascade('gone');

    expect(saveOrder).toEqual(['remove', 'save']);
    expect(tagsService.removed).toEqual(['gone']);
  });

  it('deleteCascade only touches entities that reference the deleted tag', async () => {
    notes.seed([
      { id: 'n1', tags: ['gone'] },
      { id: 'n2', tags: ['other'] },
    ]);
    const admin = TestBed.inject(TagsAdminService);

    await admin.deleteCascade('gone');

    expect((await notes.read('n2')).tags).toEqual(['other']);
  });
});
