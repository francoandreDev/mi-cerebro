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

import { TaggedItemsService } from './tagged-items.service';

// why: TaggedItemsService only ever calls .summaries() on each of the 8
//      entity services (never reads/writes), so a bare `{ summaries }` stub
//      covers the contract without pulling in real FS/IDB plumbing.
const stub = (items: readonly unknown[]) => ({ summaries: signal(items) });
const stubTracks = (items: readonly unknown[]) => ({ tracks: signal(items) });

describe('TaggedItemsService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: NotesService,
          useValue: stub([{ id: 'n1', title: 'Nota', tags: ['work'] }]),
        },
        {
          provide: TasksService,
          useValue: stub([{ id: 't1', title: 'Tarea', tags: ['work', 'urgent'] }]),
        },
        { provide: GoalsService, useValue: stub([{ id: 'g1', title: 'Meta', tags: [] }]) },
        { provide: ListsService, useValue: stub([]) },
        { provide: WritingsService, useValue: stub([]) },
        { provide: BooksService, useValue: stub([]) },
        { provide: GalleriesService, useValue: stub([]) },
        { provide: FilesService, useValue: stub([]) },
        { provide: MusicLibraryService, useValue: stubTracks([]) },
        { provide: PlaylistsService, useValue: stub([]) },
      ],
    });
  });

  it('projects every entity kind into a single unified list', () => {
    const svc = TestBed.inject(TaggedItemsService);
    const items = svc.allItems();
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.kind).sort()).toEqual(['goal', 'note', 'task']);
  });

  it('filters across kinds by tag id', () => {
    const svc = TestBed.inject(TaggedItemsService);
    const work = svc.forTag('work');
    expect(work.map((i) => i.kind).sort()).toEqual(['note', 'task']);
    expect(svc.forTag('urgent').map((i) => i.kind)).toEqual(['task']);
    expect(svc.forTag('unused')).toEqual([]);
  });
});
