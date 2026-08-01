import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { ErrorService } from '@core/errors/error.service';
import { withReauthIfNeeded } from '@core/errors/with-reauth';
import { handleCreateFolder, openFolderActionDialog } from '@core/folders/folder-crud';
import { FoldersService } from '@core/folders/folders.service';
import { WorkspaceService } from '@core/fs/workspace.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { entitySlugSegment } from '@core/routing/entity-slug';
import { SettingsService } from '@core/settings/settings.service';
import type { Tag } from '@core/tags/tag.types';
import { TagsService } from '@core/tags/tags.service';
import { ConfirmController } from '@shared/confirm-dialog/confirm-controller';
import { ConfirmDialogComponent } from '@shared/confirm-dialog/confirm-dialog.component';
import { FolderActionDialogComponent } from '@shared/folder-action-dialog/folder-action-dialog.component';
import { FolderActionDialogController } from '@shared/folder-action-dialog/folder-action-dialog.controller';
import { FolderBreadcrumbComponent } from '@shared/folder-breadcrumb/folder-breadcrumb.component';
import { IconComponent } from '@shared/icon/icon.component';
import { TagChipComponent } from '@shared/tags/tag-chip.component';
import { RowNavController } from '@shared/utils/row-nav.controller';

import { GoalPeekOverlayComponent } from '../components/goal-peek-overlay.component';
import type { GoalSummary } from '../models/goal.types';
import { GoalsService } from '../services/goals.service';
import { GoalPeekController } from './goal-peek.controller';
import { registerGoalsFoldersTutorial } from './goals-folders.tutorial';
import { registerGoalsTutorial } from './goals.tutorial';
import {
  buildConstellationLinks,
  buildStars,
  constellationCenter,
  normTitle,
  type StarVm,
} from './goal-wall-layout.utils';

const VIEW_KEY = 'mc.goals.wall.viewMode';
type ViewMode = 'wall' | 'list';
const readView = (): ViewMode => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'wall';
  } catch {
    return 'wall';
  }
};
const persistView = (v: ViewMode): void => {
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch {
    /* ignore quota */
  }
};

@Component({
  selector: 'mc-goals-wall',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ConfirmDialogComponent,
    IconComponent,
    TagChipComponent,
    GoalPeekOverlayComponent,
    FolderBreadcrumbComponent,
    FolderActionDialogComponent,
  ],
  templateUrl: './goals-wall.container.html',
  styleUrl: './goals-wall.container.css',
})
export class GoalsWallContainer {
  private readonly goalsService = inject(GoalsService);
  private readonly tagsService = inject(TagsService);
  private readonly workspace = inject(WorkspaceService);
  private readonly foldersService = inject(FoldersService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);
  private readonly settings = inject(SettingsService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly rowNav = new RowNavController(
    {
      rowIds: () => this.listGoals().map((g) => g.id),
      onToggle: (id) => void this.toggleCompleted(id),
      onOpen: (id) => void this.openGoal(id),
      onDelete: (id) => this.removeGoal(id),
    },
    {
      next: 'goals.shortcuts.next',
      prev: 'goals.shortcuts.prev',
      open: 'goals.shortcuts.open',
      toggle: 'goals.shortcuts.toggleCompleted',
      del: 'goals.shortcuts.delete',
    },
    'goals',
  );
  protected readonly cursor = this.rowNav.cursor;
  protected readonly viewMode = signal<ViewMode>(readView());

  constructor() {
    registerGoalsTutorial();
    registerGoalsFoldersTutorial();
    const unregister = this.rowNav.register();
    this.destroyRef.onDestroy(unregister);
    effect(() => {
      const id = this.cursor.focusedId();
      if (!id) return;
      queueMicrotask(() => {
        document
          .querySelector(`[data-goal-row="${CSS.escape(id)}"]`)
          ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    });
  }

  protected readonly tags = this.tagsService.tags;
  protected readonly summaries = this.goalsService.summaries;
  protected readonly query = signal<string>('');

  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  protected readonly currentFolder = computed(() => this.params().get('folder') ?? '');
  protected readonly allFolders = this.goalsService.folders;

  private readonly inCurrentFolder = computed<readonly GoalSummary[]>(() =>
    this.summaries().filter((s) => s.folder === this.currentFolder()),
  );
  protected readonly activeTagIds = signal<ReadonlySet<string>>(new Set());
  protected readonly hideCompleted = signal<boolean>(false);
  protected readonly creating = signal<boolean>(false);
  protected readonly newTitle = signal<string>('');

  protected readonly today = signal<string>(new Date().toISOString().slice(0, 10));

  // why: §13 — 1er click sobre cualquier estrella de una constelación enfoca
  //      la meta y abre un peek con título/plazo/progreso/prioridad editables.
  //      Sólo cuando la meta ya está enfocada, un 2do click hace el toggle
  //      del step (o navega si es solitaria). Click fuera/Esc cierra el peek.
  //      Extraído a GoalPeekController (§4.4 límite duro de 300 líneas).
  protected readonly confirm = new ConfirmController();
  protected readonly folderActionDialog = new FolderActionDialogController();
  protected readonly peek = new GoalPeekController(this.goalsService.summaries, (title, onAccept) =>
    this.confirm.ask(
      {
        title: this.t('goals.confirm.delete.title'),
        message: this.t('goals.deleteConfirm').replace(
          '{title}',
          title || this.t('goals.untitledTitle'),
        ),
        confirmLabel: this.t('goals.confirm.delete.confirm'),
        cancelLabel: this.t('goals.confirm.cancel'),
        tone: 'danger',
      },
      onAccept,
    ),
  );
  // why: drag de constelación entera en el wall. dragCenter es el centro
  //      en vivo durante el arrastre; se persiste en `goal.wallCenter` al soltar.
  protected readonly dragCenter = signal<{ goalId: string; x: number; y: number } | null>(null);
  private dragRef: {
    id: string;
    ox: number;
    oy: number;
    sx: number;
    sy: number;
    w: number;
    h: number;
    moved: boolean;
  } | null = null;

  private centerOf(s: { id: string; wallCenter?: { x: number; y: number } }): {
    cx: number;
    cy: number;
  } {
    const d = this.dragCenter();
    if (d && d.goalId === s.id) return { cx: d.x, cy: d.y };
    if (s.wallCenter) return { cx: s.wallCenter.x, cy: s.wallCenter.y };
    return constellationCenter(s.id);
  }

  protected readonly peekAnchor = computed<{ x: number; y: number } | null>(() => {
    const s = this.peek.summary();
    if (!s) return null;
    const { cx, cy } = this.centerOf(s);
    return { x: cx, y: cy };
  });

  protected readonly untitledLabel = computed(() => this.t('goals.untitledTitle'));

  protected readonly availableTags = computed<readonly Tag[]>(() => {
    const used = new Set<string>();
    for (const s of this.summaries()) for (const id of s.tags) used.add(id);
    return this.tags().filter((t) => used.has(t.id));
  });

  protected readonly empty = computed(() => this.inCurrentFolder().length === 0);

  protected readonly hasFilter = computed(
    () => this.query().trim() !== '' || this.activeTagIds().size > 0 || this.hideCompleted(),
  );

  protected readonly stars = computed<readonly StarVm[]>(() =>
    buildStars(
      this.inCurrentFolder(),
      { query: this.query(), tagIds: this.activeTagIds(), hideCompleted: this.hideCompleted() },
      this.today(),
      (goal) => this.centerOf(goal),
      { untitled: this.untitledLabel(), stepPlaceholder: this.t('goals.steps.placeholder') },
      this.settings.state().goals.dormantThresholdDays,
      Date.now(),
    ),
  );

  protected readonly links = computed(() => buildConstellationLinks(this.stars()));

  // why: J/K cursor + list-mode order — `summaries()` is already sorted by
  //      GoalsService's comparator (not-completed first, then
  //      GoalSummary.position), the same order the service maintains for
  //      the entity tree — mirrors it instead of inventing a wall-specific
  //      one (see docs/deferred/reminders-goals.md).
  protected readonly listGoals = computed<readonly GoalSummary[]>(() => {
    const q = normTitle(this.query().trim());
    const tagIds = this.activeTagIds();
    const hideCompleted = this.hideCompleted();
    return this.inCurrentFolder().filter((g) => {
      if (q && !normTitle(g.title).includes(q)) return false;
      if (tagIds.size > 0 && !g.tags.some((id) => tagIds.has(id))) return false;
      if (hideCompleted && g.completed) return false;
      return true;
    });
  });

  protected readonly allDim = computed(
    () => this.stars().length > 0 && this.stars().every((s) => s.dim),
  );

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onStarDown(star: StarVm, ev: PointerEvent): void {
    if (ev.button !== 0) return;
    const t = ev.currentTarget as Element;
    t.setPointerCapture(ev.pointerId);
    const canvas = t.closest('.sky-canvas') as HTMLElement | null;
    const r = (canvas ?? document.body).getBoundingClientRect();
    const goal = this.summaries().find((s) => s.id === star.goalId);
    const { cx, cy } = this.centerOf(goal ?? { id: star.goalId });
    this.dragRef = {
      id: star.goalId,
      ox: cx,
      oy: cy,
      sx: ev.clientX,
      sy: ev.clientY,
      w: r.width,
      h: r.height,
      moved: false,
    };
  }
  protected onStarMove(ev: PointerEvent): void {
    const d = this.dragRef;
    if (!d) return;
    const dx = ev.clientX - d.sx,
      dy = ev.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    d.moved = true;
    this.dragCenter.set({
      goalId: d.id,
      x: Math.max(8, Math.min(92, d.ox + (dx / d.w) * 100)),
      y: Math.max(8, Math.min(92, d.oy + (dy / d.h) * 100)),
    });
  }
  protected async onStarUp(star: StarVm, ev: PointerEvent): Promise<void> {
    const d = this.dragRef;
    if (!d || d.id !== star.goalId) return;
    const pos = this.dragCenter();
    this.dragRef = null;
    this.dragCenter.set(null);
    if (d.moved && pos) {
      try {
        await this.workspace.ensureWritable();
        await this.goalsService.patch(star.goalId, { wallCenter: { x: pos.x, y: pos.y } });
      } catch (e) {
        this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
      }
      return;
    }
    await this.onStarTap(star, ev);
  }
  private async onStarTap(star: StarVm, ev: PointerEvent): Promise<void> {
    if (ev.shiftKey) {
      this.peek.close();
      await this.router.navigate([
        '/goals',
        entitySlugSegment(this.goalTitle(star.goalId), star.goalId),
      ]);
      return;
    }
    if (this.peek.goalId() !== star.goalId) {
      this.peek.open(star.goalId);
      return;
    }
    if (star.stepId === null) {
      this.peek.close();
      await this.router.navigate([
        '/goals',
        entitySlugSegment(this.goalTitle(star.goalId), star.goalId),
      ]);
      return;
    }
    try {
      await this.workspace.ensureWritable();
      await this.goalsService.toggleStep(star.goalId, star.stepId);
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }

  private goalTitle(id: string): string {
    return this.summaries().find((s) => s.id === id)?.title ?? '';
  }

  protected onQueryInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }
  protected onClearQuery(): void {
    this.query.set('');
  }
  protected onToggleTag(id: string): void {
    this.activeTagIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  protected onToggleHideCompleted(): void {
    this.hideCompleted.update((v) => !v);
  }
  protected onClearFilters(): void {
    this.query.set('');
    this.activeTagIds.set(new Set());
    this.hideCompleted.set(false);
  }
  protected isTagActive(id: string): boolean {
    return this.activeTagIds().has(id);
  }
  protected onNewTitleInput(event: Event): void {
    this.newTitle.set((event.target as HTMLInputElement).value);
  }

  protected async onCreateSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.creating()) return;
    const title = this.newTitle().trim();
    if (!title) return;
    this.creating.set(true);
    try {
      await this.workspace.ensureWritable();
      const goal = await this.goalsService.create(title, this.currentFolder());
      this.newTitle.set('');
      await this.router.navigate(['/goals', entitySlugSegment(goal.title, goal.id)]);
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    } finally {
      this.creating.set(false);
    }
  }

  protected ariaLabelFor(star: StarVm): string {
    const dormantSuffix = star.dormant ? ` · ${this.t('goals.wall.dormantBadge')}` : '';
    if (star.stepId === null)
      return this.t('goals.wall.openAria').replace('{title}', star.goalTitle) + dormantSuffix;
    const key: TranslationKey = star.done
      ? 'goals.wall.toggleStepUndone'
      : 'goals.wall.toggleStepDone';
    return (
      this.t(key).replace('{step}', star.title).replace('{goal}', star.goalTitle) + dormantSuffix
    );
  }

  protected onFolderNavigate(path: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { folder: path || null },
      queryParamsHandling: 'merge',
    });
  }

  protected onCreateSubfolder(): void {
    handleCreateFolder(
      'goal',
      this.foldersService,
      this.i18n,
      this.folderActionDialog,
      (e) => this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize())),
      this.currentFolder(),
    );
  }

  protected onManageFolder(path: string): void {
    openFolderActionDialog(
      `goal:${path}`,
      this.foldersService,
      this.i18n,
      this.folderActionDialog,
      (e) => this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize())),
    );
  }

  protected onToggleViewMode(): void {
    const next: ViewMode = this.viewMode() === 'wall' ? 'list' : 'wall';
    this.viewMode.set(next);
    persistView(next);
  }

  protected async openGoal(id: string): Promise<void> {
    await this.router.navigate(['/goals', entitySlugSegment(this.goalTitle(id), id)]);
  }

  protected async toggleCompleted(id: string): Promise<void> {
    const summary = this.summaries().find((s) => s.id === id);
    if (!summary) return;
    try {
      await this.workspace.ensureWritable();
      await this.goalsService.patch(id, { completed: !summary.completed });
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }

  protected removeGoal(id: string): void {
    const title = this.goalTitle(id);
    this.confirm.ask(
      {
        title: this.t('goals.confirm.delete.title'),
        message: this.t('goals.deleteConfirm').replace(
          '{title}',
          title || this.t('goals.untitledTitle'),
        ),
        confirmLabel: this.t('goals.confirm.delete.confirm'),
        cancelLabel: this.t('goals.confirm.cancel'),
        tone: 'danger',
      },
      async () => {
        try {
          await this.workspace.ensureWritable();
          await this.goalsService.deleteToTrash(id);
        } catch (e) {
          this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
        }
      },
    );
  }
}
