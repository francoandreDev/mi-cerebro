import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { withReauthIfNeeded } from '@core/errors/with-reauth';
import { ErrorService } from '@core/errors/error.service';
import { WorkspaceService } from '@core/fs/workspace.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';
import { TagsService } from '@core/tags/tags.service';
import { filterTree } from '@shared/tree/filter';
import { TreeFilterComponent } from '@shared/tree/tree-filter.component';
import { TreeComponent } from '@shared/tree/tree.component';
import type { FilterDirection, TreeNode } from '@shared/tree/tree.types';
import { FoldersService } from '@core/folders/folders.service';
import type { FolderKind } from '@core/folders/folders.types';
import { GoalsService } from '@features/goals/services/goals.service';
import { ListsService } from '@features/lists/services/lists.service';
import { NotesService } from '@features/notes/services/notes.service';
import { TasksService } from '@features/tasks/services/tasks.service';
import { WritingsService } from '@features/writings/services/writings.service';

import { handleCreateFolder, handleEntityAction, handleFolderAction } from './folder-actions';
import { buildFolderTree } from './folder-tree';
import { goalBadges, tagBadges, taskBadges } from './tree-badges';

type TypeFilter = 'all' | 'notes' | 'tasks' | 'goals' | 'lists' | 'writings';

@Component({
  selector: 'mc-workspace-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TreeFilterComponent, TreeComponent],
  templateUrl: './workspace-sidebar.container.html',
  styleUrl: './workspace-sidebar.container.css',
})
export class WorkspaceSidebarContainer {
  private readonly notesService = inject(NotesService);
  private readonly tasksService = inject(TasksService);
  private readonly goalsService = inject(GoalsService);
  private readonly listsService = inject(ListsService);
  private readonly writingsService = inject(WritingsService);
  private readonly foldersService = inject(FoldersService);
  private readonly tagsService = inject(TagsService);
  private readonly workspace = inject(WorkspaceService);
  private readonly router = inject(Router);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);

  protected readonly typeFilter = signal<TypeFilter>('all');
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
      } catch (e: unknown) {
        this.errors.report(e);
      }
    })();
  }

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  private readonly tagsById = computed(() => {
    const map = new Map<string, Tag>();
    for (const t of this.tagsService.tags()) map.set(t.id, t);
    return map;
  });

  protected readonly treeRoots = computed<readonly TreeNode[]>(() => {
    const roots: TreeNode[] = [];
    const filter = this.typeFilter();
    const lookup = this.tagsById();
    if (filter === 'all' || filter === 'notes') {
      const entities = this.notesService.summaries().map((n) => ({
        id: n.id,
        folder: n.folder,
        label: n.title || this.i18n.t('notes.untitledTitle'),
        badges: tagBadges(n.tags, lookup),
      }));
      roots.push({
        id: 'group:notes',
        label: this.i18n.t('notes.title'),
        kind: 'group',
        children: buildFolderTree({
          idPrefix: 'note',
          entities,
          folders: this.notesService.folders(),
        }),
      });
    }
    if (filter === 'all' || filter === 'tasks') {
      const entities = this.tasksService.summaries().map((t) => ({
        id: t.id,
        folder: t.folder,
        label: t.title || this.i18n.t('tasks.untitledTitle'),
        badges: taskBadges(t, lookup, this.i18n),
      }));
      roots.push({
        id: 'group:tasks',
        label: this.i18n.t('tasks.title'),
        kind: 'group',
        children: buildFolderTree({
          idPrefix: 'task',
          entities,
          folders: this.tasksService.folders(),
        }),
      });
    }
    if (filter === 'all' || filter === 'goals') {
      const entities = this.goalsService.summaries().map((g) => ({
        id: g.id,
        folder: g.folder,
        label: g.title || this.i18n.t('goals.untitledTitle'),
        badges: goalBadges(g, lookup, this.i18n),
      }));
      roots.push({
        id: 'group:goals',
        label: this.i18n.t('goals.title'),
        kind: 'group',
        children: buildFolderTree({
          idPrefix: 'goal',
          entities,
          folders: this.goalsService.folders(),
        }),
      });
    }
    if (filter === 'all' || filter === 'lists') {
      const entities = this.listsService.summaries().map((l) => ({
        id: l.id,
        folder: l.folder,
        label: l.title || this.i18n.t('lists.untitledTitle'),
        badges: tagBadges(l.tags, lookup),
      }));
      roots.push({
        id: 'group:lists',
        label: this.i18n.t('lists.title'),
        kind: 'group',
        children: buildFolderTree({
          idPrefix: 'list',
          entities,
          folders: this.listsService.folders(),
        }),
      });
    }
    if (filter === 'all' || filter === 'writings') {
      const entities = this.writingsService.summaries().map((w) => ({
        id: w.id,
        folder: w.folder,
        label: w.title || this.i18n.t('writings.untitledTitle'),
        badges: tagBadges(w.tags, lookup),
      }));
      roots.push({
        id: 'group:writings',
        label: this.i18n.t('writings.title'),
        kind: 'group',
        children: buildFolderTree({
          idPrefix: 'writing',
          entities,
          folders: this.writingsService.folders(),
        }),
      });
    }
    return roots;
  });

  protected readonly selectedNodeId = computed<string | null>(() => {
    const url = this.router.url;
    const match = /^\/(notes|tasks|goals|lists|writings)\/([^/?]+)/.exec(url);
    if (!match) return null;
    const kind =
      match[1] === 'notes'
        ? 'note'
        : match[1] === 'tasks'
          ? 'task'
          : match[1] === 'goals'
            ? 'goal'
            : match[1] === 'lists'
              ? 'list'
              : 'writing';
    return `${kind}:${match[2]}`;
  });

  protected readonly isTrashRoute = computed(() => this.router.url.startsWith('/trash'));

  protected goToTrash(): void {
    void this.router.navigate(['/trash']);
  }

  protected readonly result = computed(() =>
    filterTree(this.treeRoots(), this.query(), this.selectedNodeId(), this.direction()),
  );

  protected readonly matchedIds = computed(() => new Set(this.result().matches.map((m) => m.id)));

  protected readonly emptyKey = computed<TranslationKey>(() =>
    this.query().trim() === '' ? 'notes.empty' : 'tree.noMatches',
  );

  protected readonly isReady = this.workspace.isReady;

  protected setType(t: TypeFilter): void {
    this.typeFilter.set(t);
    this.cursor.set(0);
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

  protected async createNote(): Promise<void> {
    try {
      await this.workspace.ensureWritable();
      const note = await this.notesService.create('');
      await this.router.navigate(['/notes', note.id]);
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }

  protected async createTask(): Promise<void> {
    try {
      await this.workspace.ensureWritable();
      const task = await this.tasksService.create('');
      await this.router.navigate(['/tasks', task.id]);
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }

  protected async createGoal(): Promise<void> {
    try {
      await this.workspace.ensureWritable();
      const goal = await this.goalsService.create('');
      await this.router.navigate(['/goals', goal.id]);
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }

  protected async createList(): Promise<void> {
    try {
      await this.workspace.ensureWritable();
      const list = await this.listsService.create('');
      await this.router.navigate(['/lists', list.id]);
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }

  protected async createWriting(): Promise<void> {
    try {
      await this.workspace.ensureWritable();
      const writing = await this.writingsService.create('');
      await this.router.navigate(['/writings', writing.id]);
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }

  protected choose(nodeId: string): void {
    if (nodeId.startsWith('note:')) {
      void this.router.navigate(['/notes', nodeId.slice('note:'.length)]);
    } else if (nodeId.startsWith('task:')) {
      void this.router.navigate(['/tasks', nodeId.slice('task:'.length)]);
    } else if (nodeId.startsWith('goal:')) {
      void this.router.navigate(['/goals', nodeId.slice('goal:'.length)]);
    } else if (nodeId.startsWith('list:')) {
      void this.router.navigate(['/lists', nodeId.slice('list:'.length)]);
    } else if (nodeId.startsWith('writing:')) {
      void this.router.navigate(['/writings', nodeId.slice('writing:'.length)]);
    }
  }

  private jumpToCursor(): void {
    const match = this.result().matches[this.cursor()];
    if (match) this.choose(match.id);
  }

  protected async createFolder(kind: FolderKind): Promise<void> {
    try {
      await this.workspace.ensureWritable();
      await handleCreateFolder(kind, this.foldersService, this.i18n);
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
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
          },
          this.i18n,
        );
      }
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }
}
