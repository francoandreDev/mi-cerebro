import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';
import { IconComponent } from '@shared/icon/icon.component';
import { TagChipComponent } from '@shared/tags/tag-chip.component';

import type { GoalSummary } from '../models/goal.types';

@Component({
  selector: 'mc-goal-poster',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TagChipComponent],
  template: `
    <article
      class="poster"
      role="article"
      tabindex="0"
      [class.completed]="goal().completed"
      [class.overdue]="overdue()"
      [attr.aria-label]="ariaOpen()"
      (click)="open.emit(goal().id)"
      (keydown.enter)="open.emit(goal().id)"
      (keydown.space)="onSpace($event)"
    >
      <header class="head">
        <button
          type="button"
          class="check mc-hover-wiggle"
          [attr.aria-label]="ariaToggle()"
          [attr.aria-pressed]="goal().completed"
          (click)="onToggleClick($event)"
        >
          <mc-icon [name]="goal().completed ? 'check-square' : 'circle-dashed'" />
        </button>
        <button
          type="button"
          class="delete mc-hover-wiggle"
          [attr.aria-label]="ariaDelete()"
          (click)="onDeleteClick($event)"
        >
          <mc-icon name="trash" />
        </button>
      </header>
      <h2 class="title">{{ displayTitle() }}</h2>
      <footer class="foot">
        <div class="badges">
          @if (goal().completed) {
            <span class="badge done">{{ t('goals.wall.completedBadge') }}</span>
          } @else if (overdue()) {
            <span class="badge danger">{{ t('goals.wall.overdueBadge') }}</span>
          } @else if (deadlineLabel(); as label) {
            <span class="badge soft">{{ label }}</span>
          }
        </div>
        @if (resolvedTags().length) {
          <div class="tags">
            @for (tag of resolvedTags(); track tag.id) {
              <mc-tag-chip [tag]="tag" size="small" [compact]="true" />
            }
          </div>
        }
      </footer>
    </article>
  `,
  styles: `
    :host {
      display: block;
    }
    .poster {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-3);
      padding: var(--mc-space-4);
      min-height: 220px;
      background: var(--mc-bg-elevated);
      border: 1px solid var(--mc-border-default);
      border-radius: var(--mc-radius-lg, 12px);
      cursor: pointer;
      transition:
        transform 140ms ease,
        box-shadow 140ms ease,
        border-color 140ms ease;
    }
    .poster:hover {
      transform: translateY(-3px);
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.1);
      border-color: var(--mc-accent-primary);
    }
    .poster:focus-visible {
      outline: 2px solid var(--mc-focus-ring, var(--mc-accent-primary));
      outline-offset: 2px;
    }
    .poster.completed {
      opacity: 0.7;
    }
    .poster.overdue {
      border-color: var(--mc-state-danger, #d04a4a);
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .check,
    .delete {
      background: transparent;
      border: 0;
      color: var(--mc-fg-muted);
      cursor: pointer;
      padding: 4px 6px;
      border-radius: var(--mc-radius-sm);
      font-size: var(--mc-font-size-lg);
    }
    .check:hover,
    .check:focus-visible {
      color: var(--mc-accent-primary);
    }
    .delete {
      opacity: 0;
      transition:
        opacity 120ms ease,
        color 120ms ease;
    }
    .poster:hover .delete,
    .poster:focus-within .delete {
      opacity: 1;
    }
    .delete:hover,
    .delete:focus-visible {
      color: var(--mc-state-danger, #d04a4a);
    }
    .title {
      flex: 1;
      margin: 0;
      font-size: clamp(1.6rem, 2.6vw, 2.4rem);
      font-weight: 700;
      line-height: 1.15;
      color: var(--mc-fg-primary);
      overflow-wrap: anywhere;
    }
    .poster.completed .title {
      text-decoration: line-through;
      color: var(--mc-fg-secondary);
    }
    .foot {
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-2);
    }
    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: var(--mc-radius-pill, 999px);
      font-size: var(--mc-font-size-xs);
      font-weight: 600;
      letter-spacing: 0.02em;
    }
    .badge.soft {
      background: var(--mc-bg-muted);
      color: var(--mc-fg-secondary);
    }
    .badge.done {
      background: var(--mc-accent-primary);
      color: var(--mc-fg-on-accent, #fff);
    }
    .badge.danger {
      background: var(--mc-state-danger, #d04a4a);
      color: #fff;
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
  `,
})
export class GoalPosterComponent {
  readonly goal = input.required<GoalSummary>();
  readonly availableTags = input.required<readonly Tag[]>();
  readonly untitledLabel = input.required<string>();
  readonly today = input.required<string>();
  readonly open = output<string>();
  readonly remove = output<string>();
  readonly toggleCompleted = output<string>();

  private readonly i18n = inject(I18nService);

  protected readonly displayTitle = computed(() => this.goal().title || this.untitledLabel());
  protected readonly resolvedTags = computed(() => {
    const byId = new Map(this.availableTags().map((t) => [t.id, t] as const));
    return this.goal()
      .tags.map((id) => byId.get(id))
      .filter((t): t is Tag => t !== undefined);
  });
  protected readonly overdue = computed(() => {
    const g = this.goal();
    if (g.completed || !g.deadline) return false;
    return g.deadline < this.today();
  });
  protected readonly deadlineLabel = computed<string | null>(() => {
    const g = this.goal();
    if (g.completed || !g.deadline) return null;
    const today = this.today();
    if (g.deadline === today) return this.t('goals.wall.dueToday');
    const diff = daysBetween(today, g.deadline);
    if (diff === 1) return this.t('goals.wall.dueTomorrow');
    if (diff > 1) return this.t('goals.wall.dueIn').replace('{days}', String(diff));
    return null;
  });
  protected readonly ariaOpen = computed(() =>
    this.t('goals.wall.openAria').replace('{title}', this.displayTitle()),
  );
  protected readonly ariaDelete = computed(() =>
    this.t('goals.wall.deleteAria').replace('{title}', this.displayTitle()),
  );
  protected readonly ariaToggle = computed(() => {
    const key: TranslationKey = this.goal().completed
      ? 'goals.wall.toggleUndone'
      : 'goals.wall.toggleDone';
    return this.t(key).replace('{title}', this.displayTitle());
  });

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onSpace(event: Event): void {
    event.preventDefault();
    this.open.emit(this.goal().id);
  }

  protected onDeleteClick(event: MouseEvent): void {
    event.stopPropagation();
    this.remove.emit(this.goal().id);
  }

  protected onToggleClick(event: MouseEvent): void {
    event.stopPropagation();
    this.toggleCompleted.emit(this.goal().id);
  }
}

const daysBetween = (fromIsoDate: string, toIsoDate: string): number => {
  const from = Date.parse(`${fromIsoDate}T00:00:00`);
  const to = Date.parse(`${toIsoDate}T00:00:00`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / 86_400_000);
};
