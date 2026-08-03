// Cross-entity aggregator for the tags admin screen (§19.16c). Lives in
// core/ following the same pattern as TrashService/FoldersService/
// calendar-events.service: a core service is allowed to inject feature
// services to fan out an operation across every taggable kind, so the
// features themselves never import each other (rule §4.2.10).

import { Injectable, computed, inject } from '@angular/core';

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

import type { TaggableAdapter } from './taggable-adapter';
import {
  bookTaggableAdapter,
  fileTaggableAdapter,
  galleryTaggableAdapter,
  goalTaggableAdapter,
  listTaggableAdapter,
  noteTaggableAdapter,
  playlistTaggableAdapter,
  taskTaggableAdapter,
  trackTaggableAdapter,
  writingTaggableAdapter,
} from './taggable-adapters';
import { TagsService } from './tags.service';

@Injectable({ providedIn: 'root' })
export class TagsAdminService {
  private readonly tagsService = inject(TagsService);

  private readonly adapters: readonly TaggableAdapter[] = [
    noteTaggableAdapter(inject(NotesService)),
    taskTaggableAdapter(inject(TasksService)),
    goalTaggableAdapter(inject(GoalsService)),
    listTaggableAdapter(inject(ListsService)),
    writingTaggableAdapter(inject(WritingsService)),
    bookTaggableAdapter(inject(BooksService)),
    galleryTaggableAdapter(inject(GalleriesService)),
    fileTaggableAdapter(inject(FilesService)),
    trackTaggableAdapter(inject(MusicLibraryService)),
    playlistTaggableAdapter(inject(PlaylistsService)),
  ];

  // why: no reverse index exists (tags live only as ids on each entity's
  //      summary); counting usage is a cheap reactive walk over the 8
  //      already-loaded summaries signals rather than a persisted index.
  readonly usageCounts = computed<ReadonlyMap<string, number>>(() => {
    const counts = new Map<string, number>();
    for (const adapter of this.adapters) {
      for (const summary of adapter.summaries()) {
        for (const tagId of summary.tags) counts.set(tagId, (counts.get(tagId) ?? 0) + 1);
      }
    }
    return counts;
  });

  usageCount(tagId: string): number {
    return this.usageCounts().get(tagId) ?? 0;
  }

  // why: quick-capture's context-tag resolution (§ shortcuts-cross-section)
  //      needs "the tags of entity X of kind Y" — reuses the same adapters
  //      as usageCounts/merge instead of a new lookup mechanism.
  tagsForEntity(kind: string, id: string): readonly string[] {
    const adapter = this.adapters.find((a) => a.kind === kind);
    return adapter?.summaries().find((s) => s.id === id)?.tags ?? [];
  }

  async merge(fromId: string, toId: string): Promise<void> {
    if (fromId === toId) return;
    for (const adapter of this.adapters) {
      const affected = adapter.summaries().filter((s) => s.tags.includes(fromId));
      for (const entity of affected) {
        const nextTags = dedupe(entity.tags.map((t) => (t === fromId ? toId : t)));
        await adapter.replaceTags(entity.id, nextTags);
      }
    }
    await this.tagsService.remove(fromId);
  }

  // why: registry removal happens first — each entity service's save()
  //      already drops tag ids missing from the registry (dropStaleTags),
  //      so re-saving the entity unchanged is enough to cascade the delete.
  async deleteCascade(id: string): Promise<void> {
    await this.tagsService.remove(id);
    for (const adapter of this.adapters) {
      const affected = adapter.summaries().filter((s) => s.tags.includes(id));
      for (const entity of affected) {
        await adapter.replaceTags(entity.id, entity.tags);
      }
    }
  }
}

const dedupe = (tags: readonly string[]): readonly string[] => [...new Set(tags)];
