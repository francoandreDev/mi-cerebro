import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';

import { withReauthIfNeeded } from '@core/errors/with-reauth';
import { ErrorService } from '@core/errors/error.service';
import { FoldersService } from '@core/folders/folders.service';
import type { FolderKind } from '@core/folders/folders.types';
import { WorkspaceRefreshService } from '@core/fs/workspace-refresh.service';
import { WorkspaceService } from '@core/fs/workspace.service';
import { CreationIntentService } from '@core/intents/creation-intent.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { PlayerService } from '@core/music/player.service';
import { entitySlugSegment } from '@core/routing/entity-slug';
import { CommandPaletteService } from '@core/search/command-palette.service';
import type { Tag } from '@core/tags/tag.types';
import { TagsService } from '@core/tags/tags.service';
import { SwitchVariantService } from '@core/versioning/switch-variant.service';
import { VariantsService } from '@core/versioning/variants.service';
import { BooksService } from '@features/books/services/books.service';
import { FilesService } from '@features/files/services/files.service';
import { GoalsService } from '@features/goals/services/goals.service';
import { GalleriesService } from '@features/images/services/galleries.service';
import { ListsService } from '@features/lists/services/lists.service';
import { NotesService } from '@features/notes/services/notes.service';
import { MusicLibraryService } from '@features/music/services/music-library.service';
import { PlaylistsService } from '@features/music/services/playlists.service';
import { RemindersService } from '@features/reminders/services/reminders.service';
import { TasksService } from '@features/tasks/services/tasks.service';
import { WritingsService } from '@features/writings/services/writings.service';
import { AutocommitStatusComponent } from '@layout/components/autocommit-status.component';
import { RemoteStatusDotComponent } from '@layout/components/remote-status-dot.component';
import { BgColorDirective } from '@shared/directives/bg-color.directive';
import { IconComponent } from '@shared/icon/icon.component';
import type { IconName } from '@shared/icon/icons.data';
import { MenuButtonComponent, type MenuOption } from '@shared/menu-button/menu-button.component';
import { filterTree } from '@shared/tree/filter';
import { TreeFilterComponent, type FilterMatchEntry } from '@shared/tree/tree-filter.component';
import { TreeStateService } from '@shared/tree/tree-state.service';
import type { TreeReorderEvent } from '@shared/tree/tree-node.component';
import { TreeComponent } from '@shared/tree/tree.component';
import type { FilterDirection, TreeNode } from '@shared/tree/tree.types';

import { buildFolderTree } from '@shared/folder-tree/folder-tree';
import {
  applyEntityReorder,
  applyFolderReorder,
  type EntityReorderAdapter,
} from '@shared/folder-tree/tree-reorder';

import { handleCreateFolder, handleEntityAction, handleFolderAction } from './folder-actions';
import { goalBadges, tagBadges, taskBadges } from './tree-badges';

type EntityKind = 'note' | 'task' | 'goal' | 'list' | 'writing' | 'book' | 'image' | 'file';
type RailKey =
  | EntityKind
  | 'home'
  | 'trash'
  | 'calendar'
  | 'reminders'
  | 'music'
  | 'history'
  | 'variants'
  | 'settings'
  | 'tags';

interface RailItem {
  readonly key: EntityKind;
  readonly label: string;
  readonly icon: IconName;
}

@Component({
  selector: 'mc-workspace-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TreeFilterComponent,
    TreeComponent,
    MenuButtonComponent,
    AutocommitStatusComponent,
    RemoteStatusDotComponent,
    BgColorDirective,
    IconComponent,
  ],
  templateUrl: './workspace-sidebar.container.html',
  styleUrl: './workspace-sidebar.container.css',
  host: { '[class.no-pane]': 'hidePane()' },
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
  private readonly musicLibrary = inject(MusicLibraryService);
  private readonly playlistsService = inject(PlaylistsService);
  private readonly remindersService = inject(RemindersService);
  private readonly foldersService = inject(FoldersService);
  private readonly tagsService = inject(TagsService);
  private readonly variantsService = inject(VariantsService);
  private readonly switchVariantService = inject(SwitchVariantService);
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private readonly workspaceRefresh = inject(WorkspaceRefreshService);
  private readonly workspace = inject(WorkspaceService);
  private readonly router = inject(Router);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);
  private readonly palette = inject(CommandPaletteService);
  private readonly player = inject(PlayerService);
  private readonly treeState = inject(TreeStateService);
  private readonly creationIntent = inject(CreationIntentService);

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

  // why: /history navigates commits and diffs, not entities. The tree
  //      + search pane is dead weight there, so we collapse it to the
  //      nav rail only. The rail (cross-page navigation) always stays.
  protected readonly activeVariant = computed(() => {
    const file = this.variantsService.file();
    return file.variants.find((v) => v.id === file.activeId && !v.pendingDelete) ?? null;
  });

  protected readonly variantMenuItems = computed(() =>
    this.variantsService.file().variants.filter((v) => !v.pendingDelete),
  );
  protected readonly switchingState = this.switchVariantService.switching;
  private readonly variantMenuOpenSignal = signal(false);
  protected readonly variantMenuOpen = this.variantMenuOpenSignal.asReadonly();

  protected toggleVariantMenu(event: Event): void {
    event.stopPropagation();
    this.variantMenuOpenSignal.update((v) => !v);
  }

  protected closeVariantMenu(): void {
    this.variantMenuOpenSignal.set(false);
  }

  protected async onSwitchVariant(id: string, event: Event): Promise<void> {
    event.stopPropagation();
    this.variantMenuOpenSignal.set(false);
    try {
      await this.switchVariantService.switchTo(id);
    } catch (e: unknown) {
      this.errors.report(e);
    }
  }

  @HostListener('document:pointerdown', ['$event'])
  protected onDocClickVariant(event: Event): void {
    if (!this.variantMenuOpenSignal()) return;
    const target = event.target as Node | null;
    if (target && this.hostEl.nativeElement.contains(target)) return;
    this.variantMenuOpenSignal.set(false);
  }

  @HostListener('document:keydown.escape', ['$event'])
  protected onEscVariant(event: Event): void {
    if (this.variantMenuOpenSignal()) {
      event.preventDefault();
      this.variantMenuOpenSignal.set(false);
    }
  }

  protected readonly hidePane = computed(() => {
    const url = this.currentUrl();
    if (url === '/' || url === '' || url.startsWith('/?')) return true;
    return PANE_HIDDEN_PREFIXES.some(
      (p) => url === p || url.startsWith(`${p}/`) || url.startsWith(`${p}?`),
    );
  });

  protected onManageVariants(event: Event): void {
    event.stopPropagation();
    this.closeVariantMenu();
    void this.router.navigate(['/variants']);
  }

  constructor() {
    void (async () => {
      try {
        await this.workspaceRefresh.ensureReady();
        await this.variantsService.refresh();
      } catch (e: unknown) {
        this.errors.report(e);
      }
    })();
    effect(() => {
      const req = this.creationIntent.requestedCreate();
      if (!req) return;
      if (req.requestedAt <= this.lastCreationAt) return;
      if (!SIDEBAR_KINDS.has(req.kind)) return;
      this.lastCreationAt = req.requestedAt;
      void this.createForActive(req.kind as EntityKind);
    });
  }

  private lastCreationAt = 0;

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected readonly railItems = computed<readonly RailItem[]>(() => [
    { key: 'note', label: this.t('tree.type.notes'), icon: 'note' },
    { key: 'task', label: this.t('tree.type.tasks'), icon: 'check-square' },
    { key: 'goal', label: this.t('tree.type.goals'), icon: 'target' },
    { key: 'list', label: this.t('tree.type.lists'), icon: 'list-bullets' },
    { key: 'writing', label: this.t('tree.type.writings'), icon: 'pen-nib' },
    { key: 'book', label: this.t('tree.type.books'), icon: 'books' },
    { key: 'image', label: this.t('tree.type.images'), icon: 'image' },
    { key: 'file', label: this.t('tree.type.files'), icon: 'paperclip' },
  ]);

  protected readonly remindersOverdueCount = this.remindersService.overdueCount;

  protected readonly activeKey = computed<RailKey | null>(() => {
    const url = this.currentUrl();
    if (url === '/' || url === '' || url.startsWith('/?')) return 'home';
    if (url.startsWith('/trash')) return 'trash';
    if (url.startsWith('/calendar')) return 'calendar';
    if (url.startsWith('/reminders')) return 'reminders';
    if (url.startsWith('/music')) return 'music';
    if (url.startsWith('/history')) return 'history';
    if (url.startsWith('/variants')) return 'variants';
    if (url.startsWith('/settings')) return 'settings';
    if (url.startsWith('/tags')) return 'tags';
    const match = /^\/(notes|tasks|goals|lists|writings|books|images|files)/.exec(url);
    if (!match) return null;
    return ROUTE_TO_KIND[match[1] as keyof typeof ROUTE_TO_KIND];
  });

  protected readonly activeKind = computed<EntityKind | null>(() => {
    const k = this.activeKey();
    if (
      k === null ||
      k === 'home' ||
      k === 'trash' ||
      k === 'calendar' ||
      k === 'reminders' ||
      k === 'music' ||
      k === 'history' ||
      k === 'variants' ||
      k === 'settings' ||
      k === 'tags'
    ) {
      return null;
    }
    return k;
  });

  protected readonly activeTitle = computed<string>(() => {
    const k = this.activeKey();
    if (k === null) return this.t('app.name');
    if (k === 'home') return this.t('home.title');
    if (k === 'trash') return this.t('trash.title');
    if (k === 'calendar') return this.t('calendar.title');
    if (k === 'reminders') return this.t('reminders.title');
    if (k === 'music') return this.t('music.title');
    if (k === 'history') return this.t('versioning.history.title');
    if (k === 'variants') return this.t('variants.page.title');
    if (k === 'settings') return this.t('settings.title');
    if (k === 'tags') return this.t('tags.page.title');
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

  protected readonly treeRootParentId = computed<string>(() => {
    const k = this.activeKind();
    return k ? `root:${k}` : '';
  });

  private readonly reorderAnnouncementSignal = signal('');
  protected readonly reorderAnnouncement = this.reorderAnnouncementSignal.asReadonly();

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

  protected readonly activeMatchId = computed<string | null>(
    () => this.result().matches[this.cursor()]?.id ?? null,
  );

  private readonly nodeLabels = computed<ReadonlyMap<string, string>>(() => {
    const map = new Map<string, string>();
    const walk = (node: TreeNode): void => {
      map.set(node.id, node.label);
      for (const c of node.children ?? []) walk(c);
    };
    for (const r of this.treeRoots()) walk(r);
    return map;
  });

  protected readonly filterMatches = computed<readonly FilterMatchEntry[]>(() => {
    const labels = this.nodeLabels();
    return this.result().matches.map((m) => ({
      id: m.id,
      label: labels.get(m.id) ?? m.id,
      breadcrumb: m.path.map((id) => labels.get(id) ?? id).join(' / '),
    }));
  });

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
      if (pl.trackIds.length > 0) await this.player.playPlaylist(pl.trackIds, 0, pl.id);
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

  protected onChooseMatch(id: string): void {
    const idx = this.result().matches.findIndex((m) => m.id === id);
    if (idx >= 0) this.cursor.set(idx);
    this.choose(id);
  }

  protected onClear(): void {
    if (this.query() === '') return;
    this.query.set('');
    this.cursor.set(0);
  }

  protected goTo(key: RailKey): void {
    this.query.set('');
    this.cursor.set(0);
    if (key === 'home') {
      void this.router.navigateByUrl('/');
      return;
    }
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
    if (key === 'variants') {
      void this.router.navigate(['/variants']);
      return;
    }
    if (key === 'settings') {
      void this.router.navigate(['/settings']);
      return;
    }
    if (key === 'tags') {
      void this.router.navigate(['/tags']);
      return;
    }
    void this.router.navigate([KIND_TO_ROUTE[key]]);
    this.treeState.expandAll([`root:${key}`]);
  }

  protected async createForActive(forcedKind?: EntityKind): Promise<void> {
    const kind = forcedKind ?? this.activeKind();
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
    if (!route) return;
    const title = this.nodeLabels().get(nodeId) ?? '';
    void this.router.navigate([route, entitySlugSegment(title, id)]);
  }

  private async createByKind(kind: EntityKind): Promise<readonly [string, string]> {
    if (kind === 'note') {
      const n = await this.notesService.create('');
      return ['/notes', entitySlugSegment(n.title, n.id)];
    }
    if (kind === 'task') {
      const t = await this.tasksService.create('');
      return ['/tasks', entitySlugSegment(t.title, t.id)];
    }
    if (kind === 'goal') {
      const g = await this.goalsService.create('');
      return ['/goals', entitySlugSegment(g.title, g.id)];
    }
    if (kind === 'list') {
      const l = await this.listsService.create('');
      return ['/lists', entitySlugSegment(l.title, l.id)];
    }
    if (kind === 'writing') {
      const w = await this.writingsService.create('');
      return ['/writings', entitySlugSegment(w.title, w.id)];
    }
    if (kind === 'book') {
      const b = await this.booksService.createBook('');
      return ['/books', entitySlugSegment(b.title, b.id, 'libro')];
    }
    if (kind === 'image') {
      const g = await this.galleriesService.createGallery('');
      return ['/images', entitySlugSegment(g.title, g.id, 'galeria')];
    }
    const c = await this.filesService.createCollection('');
    return ['/files', entitySlugSegment(c.title, c.id, 'coleccion')];
  }

  private jumpToCursor(): void {
    const match = this.result().matches[this.cursor()];
    if (match) this.choose(match.id);
  }

  protected async onReorder(event: TreeReorderEvent): Promise<void> {
    try {
      await this.workspace.ensureWritable();
      if (event.movedKind === 'folder') {
        await this.applyFolderReorder(event);
      } else {
        await this.applyEntityReorder(event);
      }
    } catch (e: unknown) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }

  private async applyEntityReorder(event: TreeReorderEvent): Promise<void> {
    const kind = event.movedKind as EntityKind;
    if (!SIDEBAR_KINDS.has(kind)) return;
    const adapter: EntityReorderAdapter = {
      kind,
      summaries: () => this.summariesForKind(kind),
      moveToFolder: (id, folder) => this.moveToFolderForKind(kind, id, folder),
      setPosition: (id, position) => this.setPositionForKind(kind, id, position),
    };
    const outcome = await applyEntityReorder(event, adapter);
    if (outcome) this.announceMoved(outcome.idx);
  }

  private async applyFolderReorder(event: TreeReorderEvent): Promise<void> {
    if (!event.movedNodeId.startsWith('folder:')) return;
    const rest = event.movedNodeId.slice('folder:'.length);
    const colon = rest.indexOf(':');
    const family = colon < 0 ? rest : rest.slice(0, colon);
    if (!SIDEBAR_KINDS.has(family)) return;
    const outcome = await applyFolderReorder(event, family as FolderKind, this.foldersService);
    if (outcome) this.announceMoved(outcome.idx);
  }

  private announceMoved(idx: number): void {
    this.reorderAnnouncementSignal.set(
      this.t('tree.reorder.moved').replace('{position}', String(idx + 1)),
    );
  }

  private async moveToFolderForKind(
    kind: EntityKind,
    id: string,
    newFolder: string,
  ): Promise<void> {
    if (kind === 'note') return this.notesService.moveToFolder(id, newFolder);
    if (kind === 'task') return this.tasksService.moveToFolder(id, newFolder);
    if (kind === 'goal') return this.goalsService.moveToFolder(id, newFolder);
    if (kind === 'list') return this.listsService.moveToFolder(id, newFolder);
    if (kind === 'writing') return this.writingsService.moveToFolder(id, newFolder);
    if (kind === 'book') return this.booksService.moveBookToFolder(id, newFolder);
    if (kind === 'image') return this.galleriesService.moveGalleryToFolder(id, newFolder);
    return this.filesService.moveCollectionToFolder(id, newFolder);
  }

  private summariesForKind(
    kind: EntityKind,
  ): readonly { readonly id: string; readonly folder: string; readonly position?: string }[] {
    if (kind === 'note') return this.notesService.summaries();
    if (kind === 'task') return this.tasksService.summaries();
    if (kind === 'goal') return this.goalsService.summaries();
    if (kind === 'list') return this.listsService.summaries();
    if (kind === 'writing') return this.writingsService.summaries();
    if (kind === 'book') return this.booksService.summaries();
    if (kind === 'image') return this.galleriesService.summaries();
    return this.filesService.summaries();
  }

  private async setPositionForKind(kind: EntityKind, id: string, position: string): Promise<void> {
    if (kind === 'note') return this.notesService.setPosition(id, position);
    if (kind === 'task') return this.tasksService.setPosition(id, position);
    if (kind === 'goal') return this.goalsService.setPosition(id, position);
    if (kind === 'list') return this.listsService.setPosition(id, position);
    if (kind === 'writing') return this.writingsService.setPosition(id, position);
    if (kind === 'book') return this.booksService.setPosition(id, position);
    if (kind === 'image') return this.galleriesService.setPosition(id, position);
    return this.filesService.setPosition(id, position);
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

const PANE_HIDDEN_PREFIXES: readonly string[] = [
  '/history',
  '/variants',
  '/books',
  '/images',
  '/trash',
  '/settings',
  '/music',
  '/files',
  '/calendar',
  '/reminders',
  '/notes',
  '/tasks',
  '/goals',
  '/lists',
  '/writings',
  '/sync',
  '/tags',
];

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

const SIDEBAR_KINDS: ReadonlySet<string> = new Set([
  'note',
  'task',
  'goal',
  'list',
  'writing',
  'book',
  'image',
  'file',
]);

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
