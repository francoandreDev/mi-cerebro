import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { AutofocusDirective } from '@shared/forms/autofocus.directive';
import { IconComponent } from '@shared/icon/icon.component';
import type { IconName } from '@shared/icon/icons.data';
import { McDatePipe } from '@shared/pipes/mc-date.pipe';
import { createMultiSelect } from '@shared/utils/multi-select';

import { stepOffset } from '../containers/goal-wall-layout.utils';
import {
  GOAL_PRIORITIES,
  batchToggleStepsDone,
  deriveProgressFromSteps,
  goalDeadlineInstant,
  isValidTimeOfDay,
  newGoalStep,
  removeSteps,
  type Goal,
  type GoalPriority,
  type GoalStep,
} from '../models/goal.types';
import { GoalSelectionToolbarComponent } from './goal-selection-toolbar.component';

export type SaveStatus = 'saved' | 'saving' | 'unsaved';

interface StarVm {
  readonly id: string;
  readonly title: string;
  readonly x: number;
  readonly y: number;
  readonly done: boolean;
}

@Component({
  selector: 'mc-goal-constellation-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, McDatePipe, AutofocusDirective, GoalSelectionToolbarComponent],
  templateUrl: './goal-constellation-editor.component.html',
  styleUrl: './goal-constellation-editor.component.css',
})
export class GoalConstellationEditorComponent {
  readonly goal = input.required<Goal>();
  readonly editable = input<boolean>(true);
  readonly status = input<SaveStatus>('saved');
  readonly dormant = input<boolean>(false);
  readonly stepsChange = output<readonly GoalStep[]>();
  readonly priorityChange = output<GoalPriority>();
  readonly deadlineChange = output<string | null>();
  readonly deadlineTimeChange = output<string | null>();
  readonly titleChange = output<string>();
  readonly completedChange = output<boolean>();
  readonly removeGoal = output<void>();

  private readonly i18n = inject(I18nService);

  protected readonly priorities = GOAL_PRIORITIES;
  protected readonly creating = signal<{ x: number; y: number } | null>(null);
  protected readonly draft = signal<string>('');
  protected readonly popoverId = signal<string | null>(null);
  protected readonly renamingId = signal<string | null>(null);
  protected readonly renameDraft = signal<string>('');
  protected readonly deadlineOpen = signal<boolean>(false);
  protected readonly todayIso = new Date().toISOString().slice(0, 10);
  protected readonly renamingTitle = signal<boolean>(false);
  protected readonly titleDraft = signal<string>('');
  protected readonly hintDismissed = signal<boolean>(false);
  // why: shift+click multi-select — see docs/deferred/reminders-goals.md
  //      "Multi-select de pasos para acciones por lote". Ephemeral UI-only
  //      state, not persisted on the goal.
  protected readonly selection = createMultiSelect();

  // why: drag de estrellas. dragPos es la posición en vivo durante el arrastre;
  //      stars() la mergea para que el render y los links MST reaccionen.
  protected readonly dragPos = signal<{ id: string; x: number; y: number } | null>(null);
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
  private suppressCanvasClick = false;

  // why: lasso selection (drag a rectangle to multi-select) — pointerdown on
  //      the canvas backdrop only (stars stopPropagation their own
  //      pointerdown, see the template comment above the star `<g>`), same
  //      4px-move threshold as star drag to distinguish it from a plain
  //      click that seeds a new step. `additive` is a snapshot of the
  //      selection at drag-start, so a shift-drag adds to it instead of
  //      replacing it — same modifier convention as shift+click.
  protected readonly lassoRect = signal<{ x: number; y: number; w: number; h: number } | null>(
    null,
  );
  private lassoRef: {
    sx: number;
    sy: number;
    w: number;
    h: number;
    additive: ReadonlySet<string>;
    moved: boolean;
  } | null = null;

  protected readonly stars = computed<readonly StarVm[]>(() => {
    const g = this.goal();
    const dp = this.dragPos();
    return g.steps.map((s, i) => {
      if (dp && dp.id === s.id) return { id: s.id, title: s.title, x: dp.x, y: dp.y, done: s.done };
      if (typeof s.x === 'number' && typeof s.y === 'number')
        return { id: s.id, title: s.title, x: s.x, y: s.y, done: s.done };
      const { dx, dy } = stepOffset(s.id, Math.max(g.steps.length, i + 1));
      return { id: s.id, title: s.title, x: 50 + dx * 2, y: 50 + dy * 2, done: s.done };
    });
  });

  protected readonly links = computed(() => {
    const list = this.stars();
    if (list.length < 2)
      return [] as { a: string; x1: number; y1: number; x2: number; y2: number }[];
    const inTree = new Set<string>([list[0]!.id]);
    const out: { a: string; x1: number; y1: number; x2: number; y2: number }[] = [];
    while (inTree.size < list.length) {
      let best: { a: StarVm; b: StarVm; d: number } | null = null;
      for (const a of list) {
        if (!inTree.has(a.id)) continue;
        for (const b of list) {
          if (inTree.has(b.id)) continue;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = dx * dx + dy * dy;
          if (!best || d < best.d) best = { a, b, d };
        }
      }
      if (!best) break;
      inTree.add(best.b.id);
      out.push({ a: best.a.id, x1: best.a.x, y1: best.a.y, x2: best.b.x, y2: best.b.y });
    }
    return out;
  });

  protected readonly stepsDone = computed(() =>
    this.goal().steps.reduce((n, s) => n + (s.done ? 1 : 0), 0),
  );
  protected readonly progress = computed(
    () => deriveProgressFromSteps(this.goal().steps) ?? this.goal().progress,
  );

  protected readonly daysToDeadline = computed<number | null>(() => {
    const dl = this.goal().deadline;
    if (!dl) return null;
    const a = Date.parse(dl + 'T00:00:00');
    const b = Date.parse(new Date().toISOString().slice(0, 10) + 'T00:00:00');
    if (Number.isNaN(a) || Number.isNaN(b)) return null;
    return Math.round((a - b) / 86_400_000);
  });

  // why: posición del marcador "hoy" en la barra horizonte — proporción entre
  //      createdAt y deadline. Clamp 0-100. Sin deadline: barra inerte.
  protected readonly horizonPercent = computed<number>(() => {
    const g = this.goal();
    if (!g.deadline) return 0;
    const start = Date.parse(g.createdAt);
    const end = Date.parse(g.deadline + 'T00:00:00');
    const now = Date.now();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 100;
    return Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
  });

  // why: overdue tone checks the exact deadline instant (respects a custom
  //      `deadlineTime`), not just the calendar-day diff — a goal due today
  //      at 09:00 should tint red once 09:00 passes, not only at midnight.
  //      `daysLabel()`/`daysToDeadline()` stay day-granularity on purpose
  //      (§13's "tenés X tiempo" framing), only the tone reacts to the hour.
  protected readonly isOverdue = computed<boolean>(() => {
    const g = this.goal();
    if (!g.deadline) return false;
    const instant = goalDeadlineInstant(g.deadline, g.deadlineTime);
    return instant !== null && Date.now() > instant;
  });

  protected readonly skyTone = computed<'soon' | 'overdue' | 'completed' | 'calm'>(() => {
    if (this.goal().completed) return 'completed';
    const d = this.daysToDeadline();
    if (d === null) return 'calm';
    return this.isOverdue() ? 'overdue' : d <= 7 ? 'soon' : 'calm';
  });

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onCanvasClick(event: MouseEvent): void {
    if (!this.editable()) return;
    if (this.suppressCanvasClick) {
      this.suppressCanvasClick = false;
      return;
    }
    // why: a stray click on empty canvas while a selection is active only
    //      dismisses the selection — it must not also seed a new step in
    //      the same click.
    if (this.selection.count() > 0) {
      this.selection.clear();
      return;
    }
    if (this.popoverId() || this.renamingId() || this.creating()) {
      this.closeAllOverlays();
      return;
    }
    const rect = (event.currentTarget as SVGGraphicsElement).getBoundingClientRect();
    const x = Math.max(8, Math.min(92, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(8, Math.min(92, ((event.clientY - rect.top) / rect.height) * 100));
    this.creating.set({ x, y });
    this.draft.set('');
  }

  protected onCanvasPointerDown(event: PointerEvent): void {
    if (!this.editable() || event.button !== 0) return;
    if (this.popoverId() || this.renamingId() || this.creating()) return;
    const t = event.currentTarget as Element;
    t.setPointerCapture(event.pointerId);
    const rect = (t as SVGGraphicsElement).getBoundingClientRect();
    this.lassoRef = {
      sx: ((event.clientX - rect.left) / rect.width) * 100,
      sy: ((event.clientY - rect.top) / rect.height) * 100,
      w: rect.width,
      h: rect.height,
      additive: event.shiftKey ? this.selection.selectedIds() : new Set(),
      moved: false,
    };
  }

  protected onCanvasPointerMove(event: PointerEvent): void {
    const d = this.lassoRef;
    if (!d) return;
    const t = event.currentTarget as SVGGraphicsElement;
    const rect = t.getBoundingClientRect();
    const cx = ((event.clientX - rect.left) / rect.width) * 100;
    const cy = ((event.clientY - rect.top) / rect.height) * 100;
    if (!d.moved && Math.hypot(cx - d.sx, cy - d.sy) < 2) return;
    d.moved = true;
    const box = {
      x: Math.min(d.sx, cx),
      y: Math.min(d.sy, cy),
      w: Math.abs(cx - d.sx),
      h: Math.abs(cy - d.sy),
    };
    this.lassoRect.set(box);
    const inBox = this.stars()
      .filter((s) => s.x >= box.x && s.x <= box.x + box.w && s.y >= box.y && s.y <= box.y + box.h)
      .map((s) => s.id);
    this.selection.setSelected(new Set([...d.additive, ...inBox]));
  }

  protected onCanvasPointerUp(): void {
    const d = this.lassoRef;
    this.lassoRef = null;
    this.lassoRect.set(null);
    if (d?.moved) this.suppressCanvasClick = true;
  }

  protected onCanvasKey(event?: Event): void {
    if (!this.editable() || this.popoverId() || this.renamingId() || this.creating()) return;
    event?.preventDefault();
    this.creating.set({ x: 50, y: 50 });
    this.draft.set('');
  }
  protected onTitleInput(e: Event): void {
    this.titleDraft.set((e.target as HTMLInputElement).value);
  }
  protected onRenameInput(e: Event): void {
    this.renameDraft.set((e.target as HTMLInputElement).value);
  }
  protected onDraftInput(e: Event): void {
    this.draft.set((e.target as HTMLInputElement).value);
  }

  protected onDraftKey(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commitNewStep();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.creating.set(null);
    }
  }

  protected commitNewStep(): void {
    const pos = this.creating();
    const title = this.draft().trim();
    if (!pos) return;
    if (!title) {
      this.creating.set(null);
      return;
    }
    this.stepsChange.emit([...this.goal().steps, newGoalStep(title, pos.x, pos.y)]);
    this.creating.set(null);
    this.draft.set('');
  }

  protected onStarDown(star: StarVm, ev: PointerEvent): void {
    if (!this.editable() || ev.button !== 0) return;
    ev.stopPropagation();
    const t = ev.currentTarget as Element;
    t.setPointerCapture(ev.pointerId);
    const r = (t.closest('svg') as SVGGraphicsElement).getBoundingClientRect();
    this.dragRef = {
      id: star.id,
      ox: star.x,
      oy: star.y,
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
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    this.dragPos.set({
      id: d.id,
      x: Math.max(6, Math.min(94, d.ox + (dx / d.w) * 100)),
      y: Math.max(6, Math.min(94, d.oy + (dy / d.h) * 100)),
    });
  }
  protected onStarUp(star: StarVm, ev: PointerEvent): void {
    const d = this.dragRef;
    if (!d || d.id !== star.id) return;
    ev.stopPropagation();
    const pos = this.dragPos();
    this.dragRef = null;
    this.dragPos.set(null);
    if (d.moved && pos) {
      this.suppressCanvasClick = true;
      this.stepsChange.emit(
        this.goal().steps.map((s) => (s.id === star.id ? { ...s, x: pos.x, y: pos.y } : s)),
      );
      return;
    }
    if (ev.shiftKey) {
      // why: shift+click now toggles multi-select membership instead of the
      //      old "open popover" shortcut — the popover is still reachable
      //      via right-click (onStarContextMenu), so nothing is lost.
      this.selection.toggle(star.id);
      return;
    }
    this.toggleStep(star.id);
  }

  protected onStarContextMenu(id: string, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.editable()) return;
    this.popoverId.set(this.popoverId() === id ? null : id);
  }

  protected toggleStep(id: string): void {
    this.stepsChange.emit(
      this.goal().steps.map((s) => (s.id === id ? { ...s, done: !s.done } : s)),
    );
  }

  protected onSelectionToggleDone(): void {
    this.stepsChange.emit(batchToggleStepsDone(this.goal().steps, this.selection.selectedIds()));
    this.selection.clear();
  }

  protected onSelectionDelete(): void {
    this.stepsChange.emit(removeSteps(this.goal().steps, this.selection.selectedIds()));
    this.selection.clear();
  }

  protected onEscape(): void {
    if (this.selection.count() > 0) this.selection.clear();
  }

  protected onRenameStart(id: string): void {
    this.renameDraft.set(this.goal().steps.find((s) => s.id === id)?.title ?? '');
    this.renamingId.set(id);
    this.popoverId.set(null);
  }

  protected onRenameKey(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commitRename();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.renamingId.set(null);
    }
  }

  protected commitRename(): void {
    const id = this.renamingId();
    if (!id) return;
    const title = this.renameDraft();
    this.stepsChange.emit(this.goal().steps.map((s) => (s.id === id ? { ...s, title } : s)));
    this.renamingId.set(null);
  }

  protected onRemoveStep(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.stepsChange.emit(this.goal().steps.filter((s) => s.id !== id));
    this.popoverId.set(null);
  }

  protected onPriorityClick(p: GoalPriority): void {
    if (!this.editable() || this.goal().priority === p) return;
    this.priorityChange.emit(p);
  }

  protected onHorizonClick(): void {
    if (!this.editable()) return;
    this.deadlineOpen.set(!this.deadlineOpen());
  }

  // why: date + time live in one focusout-managed group so tabbing from the
  //      date input into the time input doesn't close the picker (a plain
  //      per-input `(blur)` would fire before the time input gets focus).
  protected onPickerFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    const wrap = event.currentTarget as HTMLElement;
    if (next && wrap.contains(next)) return;
    this.deadlineOpen.set(false);
  }

  protected onDeadlinePick(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value === '' || value < this.todayIso) return;
    this.deadlineChange.emit(value);
  }

  protected onDeadlineClear(event: Event): void {
    event.stopPropagation();
    if (event.type === 'keydown') event.preventDefault();
    this.deadlineChange.emit(null);
    this.deadlineTimeChange.emit(null);
    this.deadlineOpen.set(false);
  }

  // why: docs/deferred/reminders-goals.md "Hora del deadline configurable" —
  //      empty value clears the override back to the implicit 23:59.
  protected onDeadlineTimePick(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value === '') {
      this.deadlineTimeChange.emit(null);
      return;
    }
    if (!isValidTimeOfDay(value)) return;
    this.deadlineTimeChange.emit(value);
  }

  protected priorityKey(p: GoalPriority): TranslationKey {
    return `goals.priority.${p}` as TranslationKey;
  }

  protected popoverFor(id: string | null): StarVm | null {
    return id ? (this.stars().find((s) => s.id === id) ?? null) : null;
  }

  protected daysLabel(): string {
    const d = this.daysToDeadline();
    if (d === null) return this.t('goals.deadline.none');
    if (d === 0) return this.t('goals.deadline.today');
    if (d === 1) return this.t('goals.deadline.tomorrow');
    if (d < 0) return this.t('goals.editor.overdueLabel').replace('{n}', String(-d));
    return this.t('goals.editor.daysLeft').replace('{n}', String(d));
  }

  protected onTitleEditStart(): void {
    if (!this.editable()) return;
    this.titleDraft.set(this.goal().title);
    this.renamingTitle.set(true);
    this.closeAllOverlays();
  }
  protected onTitleKey(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commitTitle();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.renamingTitle.set(false);
    }
  }
  protected commitTitle(): void {
    const next = this.titleDraft();
    if (next !== this.goal().title) this.titleChange.emit(next);
    this.renamingTitle.set(false);
  }
  protected onCompletedToggle(e: Event): void {
    this.completedChange.emit((e.target as HTMLInputElement).checked);
  }
  protected onDeleteClick(e: MouseEvent): void {
    e.stopPropagation();
    this.removeGoal.emit();
  }
  protected statusIcon(): IconName {
    const s = this.status();
    return s === 'saving' ? 'spinner-gap' : s === 'unsaved' ? 'warning' : 'check';
  }
  protected statusLabel(): string {
    return this.t(`goals.status.${this.status()}` as TranslationKey);
  }
  protected dismissHint(): void {
    this.hintDismissed.set(true);
  }
  protected showHint(): boolean {
    const len = this.goal().steps.length;
    return !this.hintDismissed() && len >= 1 && len <= 2;
  }

  private closeAllOverlays(): void {
    this.creating.set(null);
    this.popoverId.set(null);
    this.renamingId.set(null);
    this.deadlineOpen.set(false);
  }
}
