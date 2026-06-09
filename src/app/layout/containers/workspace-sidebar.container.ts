import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { withReauthIfNeeded } from '@core/errors/with-reauth';
import { ErrorService } from '@core/errors/error.service';
import { FoldersService } from '@core/folders/folders.service';
import type { FolderKind } from '@core/folders/folders.types';
import { WorkspaceService } from '@core/fs/workspace.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { CommandPaletteService } from '@core/search/command-palette.service';
import type { Tag } from '@core/tags/tag.types';
import { TagsService } from '@core/tags/tags.service';
import { BooksService } from '@features/books/services/books.service';
import { GoalsService } from '@features/goals/services/goals.service';
import { ListsService } from '@features/lists/services/lists.service';
import { NotesService } from '@features/notes/services/notes.service';
import { TasksService } from '@features/tasks/services/tasks.service';
import { WritingsService } from '@features/writings/services/writings.service';
import { MenuButtonComponent, type MenuOption } from '@shared/menu-button/menu-button.component';
import { filterTree } from '@shared/tree/filter';
import { TreeFilterComponent } from '@shared/tree/tree-filter.component';
import { TreeStateService } from '@shared/tree/tree-state.service';
import { TreeComponent } from '@shared/tree/tree.component';
import type { FilterDirection, TreeNode } from '@shared/tree/tree.types';

import { handleCreateFolder, handleEntityAction, handleFolderAction } from './folder-actions';
import { buildFolderTree } from './folder-tree';
import { goalBadges, tagBadges, taskBadges } from './tree-badges';

type EntityKey = 'note' | 'task' | 'goal' | 'list' | 'writing' | 'book';

@Component({
  selector: 'mc-workspace-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TreeFilterComponent, TreeComponent, MenuButtonComponent],
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
  private readonly foldersService = inject(FoldersService);
  private readonly tagsService = inject(TagsService);
  private readonly workspace = inject(WorkspaceService);
  private readonly router = inject(Router);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);
  private readonly palette = inject(CommandPaletteService);
  private readonly treeState = inject(TreeStateService);

  protected readonly query = signal('');
  protected readonly direction = signal<FilterDirection>('general');
  private readonly cursor = signal(0);

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
      } catch (e: unknown) {
        this.errors.report(e);
      }
    })();
    this.treeState.expandAll([
      'group:notes',
      'group:tasks',
      'group:goals',
      'group:lists',
      'group:writings',
      'group:books',
    ]);
  }

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  private readonly tagsById = computed(() => {
    const map = new Map<string, Tag>();
    for (const t of this.tagsService.tags()) map.set(t.id, t);
    return map;
  });

  protected readonly newOptions = computed<readonly MenuOption[]>(() => [
    { key: 'note', label: this.t('notes.new') },
    { key: 'task', label: this.t('tasks.new') },
    { key: 'goal', label: this.t('goals.new') },
    { key: 'list', label: this.t('lists.new') },
    { key: 'writing', label: this.t('writings.new') },
    { key: 'book', label: this.t('books.new') },
  ]);

  protected readonly folderOptions = computed<readonly MenuOption[]>(() => [
    { key: 'note', label: this.t('tree.type.notes') },
    { key: 'task', label: this.t('tree.type.tasks') },
    { key: 'goal', label: this.t('tree.type.goals') },
    { key: 'list', label: this.t('tree.type.lists') },
    { key: 'writing', label: this.t('tree.type.writings') },
    { key: 'book', label: this.t('tree.type.books') },
  ]);

  protected readonly treeRoots = computed<readonly TreeNode[]>(() => {
    const lookup = this.tagsById();
    const notes = this.notesService.summaries().map((n) => ({
      id: n.id,
      folder: n.folder,
      label: n.title || this.i18n.t('notes.untitledTitle'),
      badges: tagBadges(n.tags, lookup),
    }));
    const tasks = this.tasksService.summaries().map((tk) => ({
      id: tk.id,
      folder: tk.folder,
      label: tk.title || this.i18n.t('tasks.untitledTitle'),
      badges: taskBadges(tk, lookup, this.i18n),
    }));
    const goals = this.goalsService.summaries().map((g) => ({
      id: g.id,
      folder: g.folder,
      label: g.title || this.i18n.t('goals.untitledTitle'),
      badges: goalBadges(g, lookup, this.i18n),
    }));
    const lists = this.listsService.summaries().map((l) => ({
      id: l.id,
      folder: l.folder,
      label: l.title || this.i18n.t('lists.untitledTitle'),
      badges: tagBadges(l.tags, lookup),
    }));
    const writings = this.writingsService.summaries().map((w) => ({
      id: w.id,
      folder: w.folder,
      label: w.title || this.i18n.t('writings.untitledTitle'),
      badges: tagBadges(w.tags, lookup),
    }));
    const books = this.booksService.summaries().map((b) => ({
      id: b.id,
      folder: b.folder,
      label: b.title || this.i18n.t('books.untitledTitle'),
      badges: tagBadges(b.tags, lookup),
    }));
    return [
      {
        id: 'group:notes',
        label: this.i18n.t('notes.title'),
        kind: 'group',
        children: buildFolderTree({
          idPrefix: 'note',
          entities: notes,
          folders: this.notesService.folders(),
        }),
      },
      {
        id: 'group:tasks',
        label: this.i18n.t('tasks.title'),
        kind: 'group',
        children: buildFolderTree({
          idPrefix: 'task',
          entities: tasks,
          folders: this.tasksService.folders(),
        }),
      },
      {
        id: 'group:goals',
        label: this.i18n.t('goals.title'),
        kind: 'group',
        children: buildFolderTree({
          idPrefix: 'goal',
          entities: goals,
          folders: this.goalsService.folders(),
        }),
      },
      {
        id: 'group:lists',
        label: this.i18n.t('lists.title'),
        kind: 'group',
        children: buildFolderTree({
          idPrefix: 'list',
          entities: lists,
          folders: this.listsService.folders(),
        }),
      },
      {
        id: 'group:writings',
        label: this.i18n.t('writings.title'),
        kind: 'group',
        children: buildFolderTree({
          idPrefix: 'writing',
          entities: writings,
          folders: this.writingsService.folders(),
        }),
      },
      {
        id: 'group:books',
        label: this.i18n.t('books.title'),
        kind: 'group',
        children: buildFolderTree({
          idPrefix: 'book',
          entities: books,
          folders: this.booksService.folders(),
        }),
      },
    ];
  });

  protected readonly selectedNodeId = computed<string | null>(() => {
    const url = this.router.url;
    const match = /^\/(notes|tasks|goals|lists|writings|books)\/([^/?]+)/.exec(url);
    if (!match) return null;
    const kind = ROUTE_TO_KIND[match[1] as keyof typeof ROUTE_TO_KIND];
    return `${kind}:${match[2]}`;
  });

  protected readonly isTrashRoute = computed(() => this.router.url.startsWith('/trash'));

  protected goToTrash(): void {
    void this.router.navigate(['/trash']);
  }

  protected openPalette(): void {
    this.palette.show();
  }

  protected readonly result = computed(() =>
    filterTree(this.treeRoots(), this.query(), this.selectedNodeId(), this.direction()),
  );

  protected readonly matchedIds = computed(() => new Set(this.result().matches.map((m) => m.id)));

  protected readonly emptyKey = computed<TranslationKey>(() =>
    this.query().trim() === '' ? 'notes.empty' : 'tree.noMatches',
  );

  protected readonly isReady = this.workspace.isReady;

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

  protected async onCreateEntity(key: string): Promise<void> {
    try {
      await this.workspace.ensureWritable();
      const [route, id] = await this.createByKind(key as EntityKey);
      await this.router.navigate([route, id]);
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }

  protected async onCreateFolderFor(key: string): Promise<void> {
    try {
      await this.workspace.ensureWritable();
      await handleCreateFolder(key as FolderKind, this.foldersService, this.i18n);
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }

  protected choose(nodeId: string): void {
    const colon = nodeId.indexOf(':');
    if (colon < 0) return;
    const kind = nodeId.slice(0, colon);
    const id = nodeId.slice(colon + 1);
    const route = KIND_TO_ROUTE[kind as EntityKey];
    if (route) void this.router.navigate([route, id]);
  }

  private async createByKind(kind: EntityKey): Promise<readonly [string, string]> {
    if (kind === 'note') return ['/notes', (await this.notesService.create('')).id];
    if (kind === 'task') return ['/tasks', (await this.tasksService.create('')).id];
    if (kind === 'goal') return ['/goals', (await this.goalsService.create('')).id];
    if (kind === 'list') return ['/lists', (await this.listsService.create('')).id];
    if (kind === 'writing') return ['/writings', (await this.writingsService.create('')).id];
    return ['/books', (await this.booksService.createBook('')).id];
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
} as const;

const KIND_TO_ROUTE: Record<EntityKey, string> = {
  note: '/notes',
  task: '/tasks',
  goal: '/goals',
  list: '/lists',
  writing: '/writings',
  book: '/books',
};
