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
import { McDatePipe } from '@shared/pipes/mc-date.pipe';

import { GOAL_PRIORITIES, type GoalPriority, type GoalSummary } from '../models/goal.types';

const PRIORITY_KEY: Record<GoalPriority, TranslationKey> = {
  low: 'goals.priority.low',
  med: 'goals.priority.med',
  high: 'goals.priority.high',
};

@Component({
  selector: 'mc-goal-peek-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, McDatePipe, AutofocusDirective],
  templateUrl: './goal-peek-overlay.component.html',
  styleUrl: './goal-peek-overlay.component.css',
})
export class GoalPeekOverlayComponent {
  readonly summary = input.required<GoalSummary>();
  readonly anchorX = input.required<number>();
  readonly anchorY = input.required<number>();
  readonly today = input.required<string>();
  readonly titleChange = output<string>();
  readonly completedChange = output<boolean>();
  readonly deadlineChange = output<string | null>();
  readonly priorityChange = output<GoalPriority>();
  readonly removeGoal = output<void>();
  readonly openMap = output<void>();
  readonly closed = output<void>();

  protected readonly priorities = GOAL_PRIORITIES;
  protected readonly renaming = signal<boolean>(false);
  protected readonly titleDraft = signal<string>('');
  protected readonly deadlineOpen = signal<boolean>(false);

  protected readonly progressPct = computed(() => {
    const s = this.summary();
    if (s.stepsTotal === 0) return s.progress;
    return Math.round((s.stepsDone / s.stepsTotal) * 100);
  });

  protected readonly daysLabel = computed<string | null>(() => {
    const s = this.summary();
    if (!s.deadline) return null;
    const a = Date.parse(s.deadline + 'T00:00:00');
    const b = Date.parse(this.today() + 'T00:00:00');
    if (Number.isNaN(a) || Number.isNaN(b)) return null;
    const d = Math.round((a - b) / 86_400_000);
    if (d < 0) return this.t('goals.editor.overdueLabel').replace('{n}', '' + Math.abs(d));
    if (d === 0) return this.t('goals.deadline.today');
    if (d === 1) return this.t('goals.deadline.tomorrow');
    return this.t('goals.editor.daysLeft').replace('{n}', '' + d);
  });

  private readonly i18n = inject(I18nService);
  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }
  protected priorityKey(p: GoalPriority): TranslationKey {
    return PRIORITY_KEY[p];
  }

  protected onTitleEditStart(): void {
    this.titleDraft.set(this.summary().title);
    this.renaming.set(true);
    this.deadlineOpen.set(false);
  }
  protected onTitleKey(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commitTitle();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.renaming.set(false);
    }
  }
  protected commitTitle(): void {
    const next = this.titleDraft().trim();
    this.renaming.set(false);
    if (next !== '' && next !== this.summary().title) this.titleChange.emit(next);
  }

  protected onCompletedToggle(event: Event): void {
    this.completedChange.emit((event.target as HTMLInputElement).checked);
  }

  protected onDeadlineClick(): void {
    this.deadlineOpen.set(true);
  }
  protected onDeadlinePick(event: Event): void {
    const v = (event.target as HTMLInputElement).value;
    if (v !== '' && v < this.today()) return;
    this.deadlineChange.emit(v === '' ? null : v);
  }
  protected onDeadlineClear(event: Event): void {
    event.stopPropagation();
    if (event.type === 'keydown') event.preventDefault();
    this.deadlineChange.emit(null);
  }

  protected onPriorityClick(p: GoalPriority): void {
    if (p !== this.summary().priority) this.priorityChange.emit(p);
  }

  protected onCloseClick(event: MouseEvent): void {
    event.stopPropagation();
    this.closed.emit();
  }
  protected onTitleInput(e: Event): void {
    this.titleDraft.set((e.target as HTMLInputElement).value);
  }
  protected onOpenMapClick(event: MouseEvent): void {
    event.stopPropagation();
    this.openMap.emit();
  }
  protected onDeleteClick(event: MouseEvent): void {
    event.stopPropagation();
    this.removeGoal.emit();
  }

  protected progressLabel(): string {
    const s = this.summary();
    if (s.stepsTotal === 0) return this.t('goals.wall.peekProgressEmpty');
    return this.t('goals.wall.peekProgress')
      .replace('{done}', '' + s.stepsDone)
      .replace('{total}', '' + s.stepsTotal)
      .replace('{pct}', '' + this.progressPct());
  }
}
