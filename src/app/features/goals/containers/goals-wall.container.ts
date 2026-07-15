import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { ErrorService } from '@core/errors/error.service';
import { withReauthIfNeeded } from '@core/errors/with-reauth';
import { handleCreateFolder, handleFolderAction } from '@core/folders/folder-crud';
import { FoldersService } from '@core/folders/folders.service';
import { WorkspaceService } from '@core/fs/workspace.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { entitySlugSegment } from '@core/routing/entity-slug';
import type { Tag } from '@core/tags/tag.types';
import { TagsService } from '@core/tags/tags.service';
import { FolderBreadcrumbComponent } from '@shared/folder-breadcrumb/folder-breadcrumb.component';
import { IconComponent } from '@shared/icon/icon.component';
import { TagChipComponent } from '@shared/tags/tag-chip.component';

import { GoalPeekOverlayComponent } from '../components/goal-peek-overlay.component';
import type { GoalPriority, GoalSummary } from '../models/goal.types';
import { GoalsService } from '../services/goals.service';
import { constellationCenter, daysUntil, normTitle, stepOffset } from './goal-wall-layout.utils';

export type StarState = 'completed' | 'overdue' | 'soon' | 'active';

export interface StarVm {
  readonly key: string;
  readonly goalId: string;
  readonly stepId: string | null;
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly opacity: number;
  readonly glow: number;
  readonly done: boolean;
  readonly dim: boolean;
  readonly pulsing: boolean;
  readonly state: StarState;
  readonly title: string;
  readonly goalTitle: string;
}

export interface LinkVm {
  readonly goalId: string;
  readonly a: string;
  readonly b: string;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly dim: boolean;
}

const SIZE_BY_PRIORITY: Record<GoalPriority, number> = { low: 14, med: 20, high: 30 };

@Component({
  selector: 'mc-goals-wall',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TagChipComponent, GoalPeekOverlayComponent, FolderBreadcrumbComponent],
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
  protected readonly peekGoalId = signal<string | null>(null);
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

  protected readonly peekSummary = computed<GoalSummary | null>(() => {
    const id = this.peekGoalId();
    return id ? (this.summaries().find((s) => s.id === id) ?? null) : null;
  });
  protected readonly peekAnchor = computed<{ x: number; y: number } | null>(() => {
    const s = this.peekSummary();
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

  protected readonly stars = computed<readonly StarVm[]>(() => {
    const q = normTitle(this.query().trim());
    const tagSet = this.activeTagIds();
    const hideDone = this.hideCompleted();
    const today = this.today();
    const out: StarVm[] = [];
    for (const goal of this.inCurrentFolder()) {
      const matchesQuery = !q || normTitle(goal.title).includes(q);
      const matchesTags = tagSet.size === 0 || goal.tags.some((id) => tagSet.has(id));
      const matchesDone = !hideDone || !goal.completed;
      const dim = !(matchesQuery && matchesTags && matchesDone);
      const days = daysUntil(goal.deadline, today);
      const overdue = !goal.completed && days !== null && days < 0;
      const soon = !goal.completed && days !== null && days >= 0 && days <= 7;
      const state: StarState = goal.completed
        ? 'completed'
        : overdue
          ? 'overdue'
          : soon
            ? 'soon'
            : 'active';
      const base = SIZE_BY_PRIORITY[goal.priority];
      const { cx, cy } = this.centerOf(goal);
      const steps = goal.steps;
      const goalTitle = goal.title || this.untitledLabel();
      if (steps.length === 0) {
        out.push({
          key: `g:${goal.id}`,
          goalId: goal.id,
          stepId: null,
          x: cx,
          y: cy,
          size: base,
          opacity: goal.completed ? 0.5 : 0.95,
          glow: base * 1.2,
          done: goal.completed,
          dim,
          pulsing: soon || overdue,
          state,
          title: goalTitle,
          goalTitle,
        });
        continue;
      }
      const stepSize = Math.round(base * 0.72);
      for (const step of steps) {
        // why: el editor guarda x/y absolutos (0-100) del lienzo de la meta;
        //      en el wall el centro de cada constelación es (cx, cy), así que
        //      mapeamos (x-50, y-50) y lo escalamos a la sub-región típica
        //      (~±12 de stepOffset) para que el orden relativo del editor se
        //      refleje en el wall. Sin x/y → fallback hash determinístico.
        const hasPos = typeof step.x === 'number' && typeof step.y === 'number';
        const dx = hasPos ? (step.x! - 50) * 0.25 : stepOffset(step.id, steps.length).dx;
        const dy = hasPos ? (step.y! - 50) * 0.25 : stepOffset(step.id, steps.length).dy;
        const done = goal.completed || step.done;
        out.push({
          key: `s:${goal.id}:${step.id}`,
          goalId: goal.id,
          stepId: step.id,
          x: cx + dx,
          y: cy + dy,
          size: done ? Math.round(stepSize * 0.85) : stepSize,
          opacity: done ? 0.42 : 0.95,
          glow: stepSize * (done ? 0.8 : 1.3),
          done,
          dim,
          pulsing: !done && (soon || overdue),
          state,
          title: step.title || this.t('goals.steps.placeholder'),
          goalTitle,
        });
      }
    }
    return out;
  });

  // why: MST por goal sobre sus steps → dibuja la "forma" de la constelación.
  protected readonly links = computed<readonly LinkVm[]>(() => {
    const byGoal = new Map<string, StarVm[]>();
    for (const star of this.stars()) {
      if (star.stepId === null) continue;
      let arr = byGoal.get(star.goalId);
      if (!arr) {
        arr = [];
        byGoal.set(star.goalId, arr);
      }
      arr.push(star);
    }
    const out: LinkVm[] = [];
    for (const [goalId, members] of byGoal) {
      if (members.length < 2) continue;
      const inTree = new Set<string>([members[0]!.stepId!]);
      while (inTree.size < members.length) {
        let best: { a: StarVm; b: StarVm; d: number } | null = null;
        for (const a of members) {
          if (!inTree.has(a.stepId!)) continue;
          for (const b of members) {
            if (inTree.has(b.stepId!)) continue;
            const dx = a.x - b.x,
              dy = a.y - b.y,
              d = dx * dx + dy * dy;
            if (!best || d < best.d) best = { a, b, d };
          }
        }
        if (!best) break;
        inTree.add(best.b.stepId!);
        out.push({
          goalId,
          a: best.a.stepId!,
          b: best.b.stepId!,
          x1: best.a.x,
          y1: best.a.y,
          x2: best.b.x,
          y2: best.b.y,
          dim: best.a.dim || best.b.dim,
        });
      }
    }
    return out;
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
      this.peekGoalId.set(null);
      await this.router.navigate([
        '/goals',
        entitySlugSegment(this.goalTitle(star.goalId), star.goalId),
      ]);
      return;
    }
    if (this.peekGoalId() !== star.goalId) {
      this.peekGoalId.set(star.goalId);
      return;
    }
    if (star.stepId === null) {
      this.peekGoalId.set(null);
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

  protected onPeekTitleChange(title: string): void {
    void this.patchPeek({ title });
  }
  protected onPeekCompletedChange(completed: boolean): void {
    void this.patchPeek({ completed });
  }
  protected onPeekDeadlineChange(deadline: string | null): void {
    void this.patchPeek({ deadline });
  }
  protected onPeekPriorityChange(priority: GoalPriority): void {
    void this.patchPeek({ priority });
  }
  protected onPeekClose(): void {
    this.peekGoalId.set(null);
  }
  protected async onPeekOpenMap(): Promise<void> {
    const id = this.peekGoalId();
    if (!id) return;
    this.peekGoalId.set(null);
    await this.router.navigate(['/goals', entitySlugSegment(this.goalTitle(id), id)]);
  }

  private goalTitle(id: string): string {
    return this.summaries().find((s) => s.id === id)?.title ?? '';
  }
  protected async onPeekRemove(): Promise<void> {
    const id = this.peekGoalId();
    if (!id) return;
    const label = this.summaries().find((s) => s.id === id)?.title || this.t('goals.untitledTitle');
    if (!confirm(this.t('goals.deleteConfirm').replace('{title}', label))) return;
    try {
      await this.workspace.ensureWritable();
      await this.goalsService.deleteToTrash(id);
      this.peekGoalId.set(null);
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
  }
  private async patchPeek(partial: {
    title?: string;
    completed?: boolean;
    deadline?: string | null;
    priority?: GoalPriority;
  }): Promise<void> {
    const id = this.peekGoalId();
    if (!id) return;
    try {
      await this.workspace.ensureWritable();
      await this.goalsService.patch(id, partial);
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    }
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
    if (star.stepId === null)
      return this.t('goals.wall.openAria').replace('{title}', star.goalTitle);
    const key: TranslationKey = star.done
      ? 'goals.wall.toggleStepUndone'
      : 'goals.wall.toggleStepDone';
    return this.t(key).replace('{step}', star.title).replace('{goal}', star.goalTitle);
  }

  protected onFolderNavigate(path: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { folder: path || null },
      queryParamsHandling: 'merge',
    });
  }

  protected async onCreateSubfolder(): Promise<void> {
    await handleCreateFolder('goal', this.foldersService, this.i18n, this.currentFolder());
  }

  protected async onManageFolder(path: string): Promise<void> {
    await handleFolderAction(`goal:${path}`, this.foldersService, this.i18n);
  }
}
