import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';

import { withReauthIfNeeded } from '@core/errors/with-reauth';
import { ErrorService } from '@core/errors/error.service';
import { FoldersService } from '@core/folders/folders.service';
import type { FolderKind } from '@core/folders/folders.types';
import { WorkspaceService } from '@core/fs/workspace.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { PlayerService } from '@core/music/player.service';
import { CommandPaletteService } from '@core/search/command-palette.service';
import type { Tag } from '@core/tags/tag.types';
import { TagsService } from '@core/tags/tags.service';
import { BooksService } from '@features/books/services/books.service';
import { FilesService } from '@features/files/services/files.service';
import { GoalsService } from '@features/goals/services/goals.service';
import { GalleriesService } from '@features/images/services/galleries.service';
import { ListsService } from '@features/lists/services/lists.service';
import { NotesService } from '@features/notes/services/notes.service';
import { RemindersService } from '@features/reminders/services/reminders.service';
import { MusicLibraryService } from '@features/music/services/music-library.service';
import { PlaylistsService } from '@features/music/services/playlists.service';
import { TasksService } from '@features/tasks/services/tasks.service';
import { WritingsService } from '@features/writings/services/writings.service';
import { AutocommitStatusComponent } from '@layout/components/autocommit-status.component';
import { MenuButtonComponent, type MenuOption } from '@shared/menu-button/menu-button.component';
import { filterTree } from '@shared/tree/filter';
import { TreeFilterComponent } from '@shared/tree/tree-filter.component';
import { TreeStateService } from '@shared/tree/tree-state.service';
import { TreeComponent } from '@shared/tree/tree.component';
import type { FilterDirection, TreeNode } from '@shared/tree/tree.types';

import { handleCreateFolder, handleEntityAction, handleFolderAction } from './folder-actions';
import { buildFolderTree } from './folder-tree';
import { goalBadges, tagBadges, taskBadges } from './tree-badges';

type EntityKind = 'note' | 'task' | 'goal' | 'list' | 'writing' | 'book' | 'image' | 'file';
type RailKey = EntityKind | 'trash' | 'calendar' | 'reminders' | 'music' | 'history' | 'settings';

interface RailItem {
  readonly key: EntityKind;
  readonly label: string;
  readonly icon: string;
}

@Component({
  selector: 'mc-workspace-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TreeFilterComponent, TreeComponent, MenuButtonComponent, AutocommitStatusComponent],
  templateUrl: './workspace-sidebar.container.html',
  styleUrl: './workspace-sidebar.container.css',
})
export class WorkspaceSidebarContainer {
  private readonly notesService = inject(NotesService);
  private readonly tasksService = inject(TasksService);
  private readonly goalsService = inject(GoalsService);
  private readonly listsService = inject(ListsService);
  private readonly writingsService = inject(WritingsService);
  private readonly booksService = inject(BooksService);
  private readonly galleriesService = inject(GalleriesService);
  private readonly filesService = inject(FilesService);
  private readonly remindersService = inject(RemindersService);
  private readonly musicLibrary = inject(MusicLibraryService);
  private readonly playlistsService = inject(PlaylistsService);
  private readonly foldersService = inject(FoldersService);
  private readonly tagsService = inject(TagsService);
  private readonly workspace = inject(WorkspaceService);
  private readonly router = inject(Router);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);
  private readonly palette = inject(CommandPaletteService);
  private readonly player = inject(PlayerService);
  private readonly treeState = inject(TreeStateService);

  protected readonly query = signal('');
  protected readonly direction = signal<FilterDirection>('general');
  private readonly cursor = signal(0);
  // why: router.url is a getter, not a signal — computeds reading it never
  //      invalidate, so the rail's active state stayed pinned to the first
  //      route until something else triggered CD. Project router events into
  //      a signal so every dependent computed re-derives on NavigationEnd.
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  constructor() {
    void (async () => {
      try {
        await this.tagsService.refresh();
        await this.notesService.refresh();
        await this.tasksService.refresh();
        await this.goalsService.refresh();
        await this.listsService.refresh();
        await this.writingsService.refresh();
        await this.booksService.refresh();
        await this.galleriesService.refresh();
        await this.filesService.refresh();
        await this.remindersService.refresh();
        await this.musicLibrary.refresh();
        await this.playlistsService.refresh();
      } catch (e: unknown) {
        this.errors.report(e);
      }
    })();
  }

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected readonly railItems = computed<readonly RailItem[]>(() => [
    { key: 'note', label: this.t('tree.type.notes'), icon: '📝' },
    { key: 'task', label: this.t('tree.type.tasks'), icon: '✓' },
    { key: 'goal', label: this.t('tree.type.goals'), icon: '🎯' },
    { key: 'list', label: this.t('tree.type.lists'), icon: '📋' },
    { key: 'writing', label: this.t('tree.type.writings'), icon: '✍' },
    { key: 'book', label: this.t('tree.type.books'), icon: '📚' },
    { key: 'image', label: this.t('tree.type.images'), icon: '🖼' },
    { key: 'file', label: this.t('tree.type.files'), icon: '📎' },
  ]);

  protected readonly activeKey = computed<RailKey | null>(() => {
    const url = this.currentUrl();
    if (url.startsWith('/trash')) return 'trash';
    if (url.startsWith('/calendar')) return 'calendar';
    if (url.startsWith('/reminders')) return 'reminders';
    if (url.startsWith('/music')) return 'music';
    if (url.startsWith('/history')) return 'history';
    if (url.startsWith('/settings')) return 'settings';
    const match = /^\/(notes|tasks|goals|lists|writings|books|images|files)/.exec(url);
    if (!match) return null;
    return ROUTE_TO_KIND[match[1] as keyof typeof ROUTE_TO_KIND];
  });

  protected readonly activeKind = computed<EntityKind | null>(() => {
    const k = this.activeKey();
    if (
      k === null ||
      k === 'trash' ||
      k === 'calendar' ||
      k === 'reminders' ||
      k === 'music' ||
      k === 'history' ||
      k === 'settings'
    ) {
      return null;
    }
    return k;
  });

  protected readonly activeTitle = computed<string>(() => {
    const k = this.activeKey();
    if (k === null) return this.t('app.name');
    if (k === 'trash') return this.t('trash.title');
    if (k === 'calendar') return this.t('calendar.title');
    if (k === 'reminders') return this.t('reminders.title');
    if (k === 'music') return this.t('music.title');
    if (k === 'history') return this.t('versioning.history.title');
    if (k === 'settings') return this.t('settings.title');
    return this.t(`tree.type.${KIND_TO_TYPE[k]}` as TranslationKey);
  });

  protected readonly newLabel = computed<string>(() => {
    const k = this.activeKind();
    if (!k) return '';
    return this.t(`${KIND_TO_TYPE[k]}.new` as TranslationKey);
  });

  protected readonly filterPlaceholder = computed<string>(() => {
    const k = this.activeKind();
    if (!k) return '';
    const kindLabel = this.t(`tree.type.${KIND_TO_TYPE[k]}` as TranslationKey);
    return this.t('tree.filter.placeholderIn').replace('{kind}', kindLabel);
  });

  protected readonly moreOptions = computed<readonly MenuOption[]>(() => {
    const k = this.activeKind();
    if (!k) return [];
    const kindLabel = this.t(`tree.type.${KIND_TO_TYPE[k]}` as TranslationKey);
    return [
      { key: 'folder', label: this.t('folders.newIn').replace('{kind}', kindLabel) },
      { key: 'palette', label: this.t('palette.openButton') },
    ];
  });

  private readonly tagsById = computed(() => {
    const map = new Map<string, Tag>();
    for (const t of this.tagsService.tags()) map.set(t.id, t);
    return map;
  });

  protected readonly treeRoots = computed<readonly TreeNode[]>(() => {
    const kind = this.activeKind();
    if (!kind) return [];
    const lookup = this.tagsById();
    if (kind === 'note') {
      return buildFolderTree({
        idPrefix: 'note',
        entities: this.notesService.summaries().map((n) => ({
          id: n.id,
          folder: n.folder,
          label: n.title || this.t('notes.untitledTitle'),
          badges: tagBadges(n.tags, lookup),
        })),
        folders: this.notesService.folders(),
      });
    }
    if (kind === 'task') {
      return buildFolderTree({
        idPrefix: 'task',
        entities: this.tasksService.summaries().map((tk) => ({
          id: tk.id,
          folder: tk.folder,
          label: tk.title || this.t('tasks.untitledTitle'),
          badges: taskBadges(tk, lookup, this.i18n),
        })),
        folders: this.tasksService.folders(),
      });
    }
    if (kind === 'goal') {
      return buildFolderTree({
        idPrefix: 'goal',
        entities: this.goalsService.summaries().map((g) => ({
          id: g.id,
          folder: g.folder,
          label: g.title || this.t('goals.untitledTitle'),
          badges: goalBadges(g, lookup, this.i18n),
        })),
        folders: this.goalsService.folders(),
      });
    }
    if (kind === 'list') {
      return buildFolderTree({
        idPrefix: 'list',
        entities: this.listsService.summaries().map((l) => ({
          id: l.id,
          folder: l.folder,
          label: l.title || this.t('lists.untitledTitle'),
          badges: tagBadges(l.tags, lookup),
        })),
        folders: this.listsService.folders(),
      });
    }
    if (kind === 'writing') {
      return buildFolderTree({
        idPrefix: 'writing',
        entities: this.writingsService.summaries().map((w) => ({
          id: w.id,
          folder: w.folder,
          label: w.title || this.t('writings.untitledTitle'),
          badges: tagBadges(w.tags, lookup),
        })),
        folders: this.writingsService.folders(),
      });
    }
    if (kind === 'book') {
      return buildFolderTree({
        idPrefix: 'book',
        entities: this.booksService.summaries().map((b) => ({
          id: b.id,
          folder: b.folder,
          label: b.title || this.t('books.untitledTitle'),
          badges: tagBadges(b.tags, lookup),
        })),
        folders: this.booksService.folders(),
      });
    }
    if (kind === 'image') {
      return buildFolderTree({
        idPrefix: 'image',
        entities: this.galleriesService.summaries().map((g) => ({
          id: g.id,
          folder: g.folder,
          label: g.title || this.t('images.untitledTitle'),
          badges: tagBadges(g.tags, lookup),
        })),
        folders: this.galleriesService.folders(),
      });
    }
    return buildFolderTree({
      idPrefix: 'file',
      entities: this.filesService.summaries().map((c) => ({
        id: c.id,
        folder: c.folder,
        label: c.title || this.t('files.untitledTitle'),
        badges: tagBadges(c.tags, lookup),
      })),
      folders: this.filesService.folders(),
    });
  });

  protected readonly selectedNodeId = computed<string | null>(() => {
    const url = this.currentUrl();
    const match = /^\/(notes|tasks|goals|lists|writings|books|images|files)\/([^/?]+)/.exec(url);
    if (!match) return null;
    const kind = ROUTE_TO_KIND[match[1] as keyof typeof ROUTE_TO_KIND];
    return `${kind}:${match[2]}`;
  });

  protected openPalette(): void {
    this.palette.show();
  }

  protected readonly result = computed(() =>
    filterTree(this.treeRoots(), this.query(), this.selectedNodeId(), this.direction()),
  );

  protected readonly matchedIds = computed(() => new Set(this.result().matches.map((m) => m.id)));

  protected readonly emptyKey = computed<TranslationKey>(() => {
    if (this.query().trim() !== '') return 'tree.noMatches';
    const k = this.activeKind();
    return k ? (`${KIND_TO_TYPE[k]}.empty` as TranslationKey) : 'notes.empty';
  });

  protected readonly isReady = this.workspace.isReady;

  protected readonly favoritePlaylists = computed(() =>
    this.playlistsService.summaries().filter((p) => p.favorite),
  );

  protected readonly topTracks = computed(() =>
    [...this.musicLibrary.tracks()]
      .filter((t) => (t.playCount ?? 0) > 0)
      .sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0))
      .slice(0, 10),
  );

  protected readonly currentTrackId = this.player.currentTrackId;
  protected readonly isPlaying = this.player.isPlaying;

  protected async onPlayFavoritePlaylist(id: string): Promise<void> {
    try {
      const pl = await this.playlistsService.read(id);
      if (pl.trackIds.length > 0) await this.player.playPlaylist(pl.trackIds, 0);
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected async onPlayTopTrack(id: string): Promise<void> {
    try {
      await this.player.playTrack(id);
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected onQuery(value: string): void {
    this.query.set(value);
    this.cursor.set(0);
  }

  protected onDirection(d: FilterDirection): void {
    this.direction.set(d);
    this.cursor.set(0);
  }

  protected onNext(): void {
    const total = this.result().matches.length;
    if (total === 0) return;
    this.cursor.update((c) => (c + 1) % total);
    this.jumpToCursor();
  }

  protected onPrev(): void {
    const total = this.result().matches.length;
    if (total === 0) return;
    this.cursor.update((c) => (c - 1 + total) % total);
    this.jumpToCursor();
  }

  protected onActivateFirst(): void {
    const match = this.result().matches[this.cursor()];
    if (match) this.choose(match.id);
  }

  protected onClear(): void {
    if (this.query() === '') return;
    this.query.set('');
    this.cursor.set(0);
  }

  protected goTo(key: RailKey): void {
    this.query.set('');
    this.cursor.set(0);
    if (key === 'trash') {
      void this.router.navigate(['/trash']);
      return;
    }
    if (key === 'calendar') {
      void this.router.navigate(['/calendar']);
      return;
    }
    if (key === 'reminders') {
      void this.router.navigate(['/reminders']);
      return;
    }
    if (key === 'music') {
      void this.router.navigate(['/music']);
      return;
    }
    if (key === 'history') {
      void this.router.navigate(['/history']);
      return;
    }
    if (key === 'settings') {
      void this.router.navigate(['/settings']);
      return;
    }
    void this.router.navigate([KIND_TO_ROUTE[key]]);
    this.treeState.expandAll([`root:${key}`]);
  }

  protected async createForActive(): Promise<void> {
    const kind = this.activeKind();
    if (!kind) return;
    try {
      await this.workspace.ensureWritable();
      const [route, id] = await this.createByKind(kind);
      await this.router.navigate([route, id]);
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }

  protected async onMoreChoose(key: string): Promise<void> {
    if (key === 'palette') {
      this.openPalette();
      return;
    }
    if (key === 'folder') {
      const kind = this.activeKind();
      if (!kind) return;
      try {
        await this.workspace.ensureWritable();
        await handleCreateFolder(kind as FolderKind, this.foldersService, this.i18n);
      } catch (e) {
        this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
      }
    }
  }

  protected choose(nodeId: string): void {
    const colon = nodeId.indexOf(':');
    if (colon < 0) return;
    const kind = nodeId.slice(0, colon);
    const id = nodeId.slice(colon + 1);
    const route = KIND_TO_ROUTE[kind as EntityKind];
    if (route) void this.router.navigate([route, id]);
  }

  private async createByKind(kind: EntityKind): Promise<readonly [string, string]> {
    if (kind === 'note') return ['/notes', (await this.notesService.create('')).id];
    if (kind === 'task') return ['/tasks', (await this.tasksService.create('')).id];
    if (kind === 'goal') return ['/goals', (await this.goalsService.create('')).id];
    if (kind === 'list') return ['/lists', (await this.listsService.create('')).id];
    if (kind === 'writing') return ['/writings', (await this.writingsService.create('')).id];
    if (kind === 'book') return ['/books', (await this.booksService.createBook('')).id];
    if (kind === 'image') return ['/images', (await this.galleriesService.createGallery('')).id];
    return ['/files', (await this.filesService.createCollection('')).id];
  }

  private jumpToCursor(): void {
    const match = this.result().matches[this.cursor()];
    if (match) this.choose(match.id);
  }

  protected async onNodeAction(nodeId: string): Promise<void> {
    try {
      await this.workspace.ensureWritable();
      if (nodeId.startsWith('folder:')) {
        await handleFolderAction(nodeId.slice('folder:'.length), this.foldersService, this.i18n);
      } else {
        await handleEntityAction(
          nodeId,
          {
            notes: this.notesService,
            tasks: this.tasksService,
            goals: this.goalsService,
            lists: this.listsService,
            writings: this.writingsService,
            books: this.booksService,
            galleries: this.galleriesService,
            files: this.filesService,
          },
          this.i18n,
        );
      }
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }
}

const ROUTE_TO_KIND = {
  notes: 'note',
  tasks: 'task',
  goals: 'goal',
  lists: 'list',
  writings: 'writing',
  books: 'book',
  images: 'image',
  files: 'file',
} as const;

const KIND_TO_ROUTE: Record<EntityKind, string> = {
  note: '/notes',
  task: '/tasks',
  goal: '/goals',
  list: '/lists',
  writing: '/writings',
  book: '/books',
  image: '/images',
  file: '/files',
};

const KIND_TO_TYPE: Record<
  EntityKind,
  'notes' | 'tasks' | 'goals' | 'lists' | 'writings' | 'books' | 'images' | 'files'
> = {
  note: 'notes',
  task: 'tasks',
  goal: 'goals',
  list: 'lists',
  writing: 'writings',
  book: 'books',
  image: 'images',
  file: 'files',
};
