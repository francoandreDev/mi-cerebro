import { Injectable, computed, inject } from '@angular/core';

import { BooksService } from '@features/books/services/books.service';
import { FilesService } from '@features/files/services/files.service';
import { GoalsService } from '@features/goals/services/goals.service';
import { GalleriesService } from '@features/images/services/galleries.service';
import { ListsService } from '@features/lists/services/lists.service';
import { NotesService } from '@features/notes/services/notes.service';
import { TasksService } from '@features/tasks/services/tasks.service';
import { WritingsService } from '@features/writings/services/writings.service';

import type { TaggedItem } from './tagged-item.types';

// why: lives in core/ (same reasoning as CalendarEventsService and
//      TagsAdminService) so the cross-section-by-tag view can fan out over
//      every taggable entity without features importing each other. Music
//      (tracks/playlists) has no `tags` field yet — excluded here and
//      tracked as a separate deferred item.
@Injectable({ providedIn: 'root' })
export class TaggedItemsService {
  private readonly notes = inject(NotesService);
  private readonly tasks = inject(TasksService);
  private readonly goals = inject(GoalsService);
  private readonly lists = inject(ListsService);
  private readonly writings = inject(WritingsService);
  private readonly books = inject(BooksService);
  private readonly galleries = inject(GalleriesService);
  private readonly files = inject(FilesService);

  readonly allItems = computed<readonly TaggedItem[]>(() => [
    ...this.notes.summaries().map((summary) => ({ kind: 'note' as const, summary })),
    ...this.tasks.summaries().map((summary) => ({ kind: 'task' as const, summary })),
    ...this.goals.summaries().map((summary) => ({ kind: 'goal' as const, summary })),
    ...this.lists.summaries().map((summary) => ({ kind: 'list' as const, summary })),
    ...this.writings.summaries().map((summary) => ({ kind: 'writing' as const, summary })),
    ...this.books.summaries().map((summary) => ({ kind: 'book' as const, summary })),
    ...this.galleries.summaries().map((summary) => ({ kind: 'image' as const, summary })),
    ...this.files.summaries().map((summary) => ({ kind: 'file' as const, summary })),
  ]);

  forTag(tagId: string): readonly TaggedItem[] {
    return this.allItems().filter((item) => item.summary.tags.includes(tagId));
  }
}
