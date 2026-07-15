import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

type StarState = 'completed' | 'overdue' | 'soon' | 'active';
type GoalPriority = 'low' | 'med' | 'high';

const SIZE_BY_PRIORITY: Record<GoalPriority, number> = { low: 14, med: 20, high: 30 };

const daysUntil = (deadline: string | null, todayIso: string): number | null => {
  if (!deadline) return null;
  const a = Date.parse(deadline + 'T00:00:00');
  const b = Date.parse(todayIso + 'T00:00:00');
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((a - b) / 86_400_000);
};

// why: standalone card for the cross-tag view (features/tags/tag-detail) —
//      adapted from the single-star markup in goals-wall.container.html,
//      dropped the constellation positioning/drag (no shared canvas here).
//      Takes primitive inputs instead of GoalSummary so shared/ stays free
//      of @features imports (docs/proyecto/reglas.md §4.2.10). State thresholds mirror
//      goals-wall.container.ts:143-151 exactly so a goal reads the same way
//      in both places; daysUntil is a duplicate of
//      features/goals/containers/goal-wall-layout.utils.ts for the same
//      reason.
@Component({
  selector: 'mc-goal-star-mini',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="star"
      [class.completed]="state() === 'completed'"
      [class.overdue]="state() === 'overdue'"
      [class.soon]="state() === 'soon'"
      [style.--star-size.px]="size()"
      [style.--star-glow.px]="12"
      [attr.aria-label]="displayTitle()"
      (click)="open.emit(id())"
    >
      <svg
        class="star-svg"
        viewBox="-50 -50 100 100"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        focusable="false"
      >
        <circle class="star-halo" cx="0" cy="0" r="26" />
        <circle class="star-halo-mid" cx="0" cy="0" r="12" />
        <ellipse class="star-spike" rx="44" ry="0.45" cx="0" cy="0" />
        <ellipse class="star-spike" rx="0.45" ry="44" cx="0" cy="0" />
        <ellipse
          class="star-spike star-spike-diag"
          rx="22"
          ry="0.3"
          cx="0"
          cy="0"
          transform="rotate(45)"
        />
        <ellipse
          class="star-spike star-spike-diag"
          rx="22"
          ry="0.3"
          cx="0"
          cy="0"
          transform="rotate(-45)"
        />
        <circle class="star-core" cx="0" cy="0" r="3" />
      </svg>
      <span class="star-label">{{ displayTitle() }}</span>
    </button>
  `,
  styleUrl: './goal-star-mini.component.css',
})
export class GoalStarMiniComponent {
  readonly id = input.required<string>();
  readonly title = input.required<string>();
  readonly untitledLabel = input.required<string>();
  readonly deadline = input.required<string | null>();
  readonly completed = input.required<boolean>();
  readonly priority = input.required<GoalPriority>();
  readonly today = input.required<string>();

  readonly open = output<string>();

  protected readonly displayTitle = computed(() => this.title() || this.untitledLabel());
  protected readonly size = computed(() => SIZE_BY_PRIORITY[this.priority()]);

  protected readonly state = computed<StarState>(() => {
    if (this.completed()) return 'completed';
    const days = daysUntil(this.deadline(), this.today());
    if (days !== null && days < 0) return 'overdue';
    if (days !== null && days <= 7) return 'soon';
    return 'active';
  });
}
