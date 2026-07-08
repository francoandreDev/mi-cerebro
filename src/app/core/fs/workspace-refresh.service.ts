// Re-walks every entity feed from disk. Used at app boot (by the
// workspace sidebar) and by SwitchVariantService after a checkout, so
// the in-memory state of all features matches whatever currently lives
// in the workspace folder.
//
// why: lives in core/ because variant switching is core-level; the
//      dependency surface (features → core) follows §4.2 rule 10
//      inverted-ly (core may import features as aggregators, the
//      forbidden direction is feature → feature).

import { Injectable, inject } from '@angular/core';

import { BooksService } from '@features/books/services/books.service';
import { FilesService } from '@features/files/services/files.service';
import { GoalsService } from '@features/goals/services/goals.service';
import { GalleriesService } from '@features/images/services/galleries.service';
import { ListsService } from '@features/lists/services/lists.service';
import { MusicLibraryService } from '@features/music/services/music-library.service';
import { PlaylistsService } from '@features/music/services/playlists.service';
import { NotesService } from '@features/notes/services/notes.service';
import { RemindersService } from '@features/reminders/services/reminders.service';
import { TasksService } from '@features/tasks/services/tasks.service';
import { WritingsService } from '@features/writings/services/writings.service';

import { TagsService } from '@core/tags/tags.service';

@Injectable({ providedIn: 'root' })
export class WorkspaceRefreshService {
  private readonly tags = inject(TagsService);
  private readonly notes = inject(NotesService);
  private readonly tasks = inject(TasksService);
  private readonly goals = inject(GoalsService);
  private readonly lists = inject(ListsService);
  private readonly writings = inject(WritingsService);
  private readonly books = inject(BooksService);
  private readonly galleries = inject(GalleriesService);
  private readonly files = inject(FilesService);
  private readonly reminders = inject(RemindersService);
  private readonly musicLibrary = inject(MusicLibraryService);
  private readonly playlists = inject(PlaylistsService);

  private ready = false;
  private inFlight: Promise<void> | null = null;

  // why: ordered the same way the workspace sidebar's boot chain runs,
  //      so behavior at boot and at switch is identical.
  async refreshAll(): Promise<void> {
    await this.tags.refresh();
    await this.notes.refresh();
    await this.tasks.refresh();
    await this.goals.refresh();
    await this.lists.refresh();
    await this.writings.refresh();
    await this.books.refresh();
    await this.galleries.refresh();
    await this.files.refresh();
    await this.reminders.refresh();
    await this.musicLibrary.refresh();
    await this.playlists.refresh();
    this.ready = true;
  }

  // why: boot (WorkspaceSidebarContainer) y la ruta de detalle (§20b,
  //      entity-ready.guard.ts) piden lo mismo en paralelo en un reload
  //      directo — dedupea en un único walk compartido en vez de pisarse
  //      con dos refreshAll() concurrentes, y no repite el walk una vez
  //      que ya corrió.
  async ensureReady(): Promise<void> {
    if (this.ready) return;
    if (!this.inFlight) {
      this.inFlight = this.refreshAll().finally(() => {
        this.inFlight = null;
      });
    }
    return this.inFlight;
  }
}
