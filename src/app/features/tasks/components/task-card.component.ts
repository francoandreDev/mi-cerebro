import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';
import { IconComponent } from '@shared/icon/icon.component';
import { TagChipComponent } from '@shared/tags/tag-chip.component';

import type { Bucket, BucketedTask } from '../services/task-buckets';

@Component({
  selector: 'mc-task-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TagChipComponent],
  template: `
    <article
      class="card"
      role="article"
      tabindex="0"
      [class.done]="entry().summary.done"
      [class.overdue]="entry().overdue"
      [attr.aria-label]="ariaOpen()"
      (click)="open.emit(entry().summary.id)"
      (keydown.enter)="open.emit(entry().summary.id)"
      (keydown.space)="onSpace($event)"
    >
      <header class="head">
        <button
          type="button"
          class="check"
          role="checkbox"
          [attr.aria-checked]="entry().summary.done"
          [attr.aria-label]="ariaToggle()"
          (click)="onToggleClick($event)"
          (keydown.enter)="onToggleClick($event)"
          (keydown.space)="onToggleClick($event)"
        >
          <mc-icon [name]="entry().summary.done ? 'check-square' : 'circle-dashed'" />
        </button>
        <h3 class="title">{{ displayTitle() }}</h3>
        <button
          type="button"
          class="delete mc-hover-wiggle"
          [attr.aria-label]="ariaDelete()"
          (click)="onDeleteClick($event)"
        >
          <mc-icon name="trash" />
        </button>
      </header>
      <footer class="foot">
        @if (resolvedTags().length) {
          <div class="tags">
            @for (tag of resolvedTags(); track tag.id) {
              <mc-tag-chip [tag]="tag" size="small" [compact]="true" />
            }
          </div>
        }
        <div class="meta">
          @if (dueLabel()) {
            <span class="due" [class.overdue]="entry().overdue">
              <mc-icon name="calendar-blank" />
              {{ dueLabel() }}
            </span>
          }
          <div class="move">
            @if (entry().bucket !== 'today') {
              <button
                type="button"
                class="move-btn"
                [attr.aria-label]="ariaMoveTo('today')"
                (click)="onMoveClick($event, 'today')"
              >
                {{ t('tasks.board.bucket.today.short') }}
              </button>
            }
            @if (entry().bucket !== 'week') {
              <button
                type="button"
                class="move-btn"
                [attr.aria-label]="ariaMoveTo('week')"
                (click)="onMoveClick($event, 'week')"
              >
                {{ t('tasks.board.bucket.week.short') }}
              </button>
            }
            @if (entry().bucket !== 'backlog') {
              <button
                type="button"
                class="move-btn"
                [attr.aria-label]="ariaMoveTo('backlog')"
                (click)="onMoveClick($event, 'backlog')"
              >
                {{ t('tasks.board.bucket.backlog.short') }}
              </button>
            }
          </div>
        </div>
      </footer>
    </article>
  `,
  styles: `
    :host {
      display: block;
    }
    .card {
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-2);
      padding: var(--mc-space-2) var(--mc-space-3);
      background: var(--mc-bg-elevated);
      border: 1px solid var(--mc-border-default);
      border-left: 3px solid var(--mc-accent-primary);
      border-radius: var(--mc-radius-md);
      cursor: pointer;
      transition:
        transform 120ms ease,
        box-shadow 120ms ease,
        border-color 120ms ease;
    }
    .card:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
    }
    .card:focus-visible {
      outline: 2px solid var(--mc-focus-ring, var(--mc-accent-primary));
      outline-offset: 2px;
    }
    .card.done {
      opacity: 0.55;
    }
    .card.done .title {
      text-decoration: line-through;
    }
    .card.overdue {
      border-left-color: var(--mc-state-danger, #d04a4a);
    }
    .head {
      display: flex;
      align-items: flex-start;
      gap: var(--mc-space-2);
    }
    .title {
      flex: 1;
      margin: 0;
      font-size: var(--mc-font-size-base);
      font-weight: 600;
      color: var(--mc-fg-primary);
      overflow-wrap: anywhere;
    }
    .check,
    .delete {
      background: transparent;
      border: 0;
      color: var(--mc-fg-muted);
      cursor: pointer;
      padding: 2px 4px;
      border-radius: var(--mc-radius-sm);
    }
    .check {
      color: var(--mc-accent-primary);
    }
    .delete {
      opacity: 0;
      transition:
        opacity 120ms ease,
        color 120ms ease;
    }
    .card:hover .delete,
    .card:focus-within .delete {
      opacity: 1;
    }
    .delete:hover,
    .delete:focus-visible {
      color: var(--mc-state-danger, #d04a4a);
    }
    .foot {
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-1);
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--mc-space-2);
      flex-wrap: wrap;
    }
    .due {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: var(--mc-font-size-xs);
      color: var(--mc-fg-muted);
    }
    .due.overdue {
      color: var(--mc-state-danger, #d04a4a);
      font-weight: 600;
    }
    .move {
      display: inline-flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 120ms ease;
    }
    .card:hover .move,
    .card:focus-within .move {
      opacity: 1;
    }
    .move-btn {
      background: transparent;
      border: 1px solid var(--mc-border-default);
      border-radius: var(--mc-radius-sm);
      color: var(--mc-fg-secondary);
      cursor: pointer;
      font-size: var(--mc-font-size-xs);
      padding: 2px 6px;
    }
    .move-btn:hover,
    .move-btn:focus-visible {
      border-color: var(--mc-accent-primary);
      color: var(--mc-fg-primary);
    }
  `,
})
export class TaskCardComponent {
  readonly entry = input.required<BucketedTask>();
  readonly availableTags = input.required<readonly Tag[]>();
  readonly untitledLabel = input.required<string>();
  readonly open = output<string>();
  readonly toggleDone = output<string>();
  readonly remove = output<string>();
  readonly move = output<{ id: string; bucket: Bucket }>();

  private readonly i18n = inject(I18nService);

  protected readonly displayTitle = computed(
    () => this.entry().summary.title || this.untitledLabel(),
  );

  protected readonly resolvedTags = computed(() => {
    const byId = new Map(this.availableTags().map((t) => [t.id, t] as const));
    return this.entry()
      .summary.tags.map((id) => byId.get(id))
      .filter((t): t is Tag => t !== undefined);
  });

  protected readonly dueLabel = computed(() => {
    const due = this.entry().summary.dueDates[0];
    if (!due) return '';
    if (this.entry().overdue) return this.t('tasks.due.overdue');
    const today = new Date().toISOString().slice(0, 10);
    if (due.slice(0, 10) === today) return this.t('tasks.due.today');
    return formatShort(due.slice(0, 10));
  });

  protected readonly ariaOpen = computed(() =>
    this.t('tasks.board.openAria').replace('{title}', this.displayTitle()),
  );
  protected readonly ariaDelete = computed(() =>
    this.t('tasks.board.deleteAria').replace('{title}', this.displayTitle()),
  );
  protected readonly ariaToggle = computed(() =>
    this.entry().summary.done
      ? this.t('tasks.board.toggleUndone').replace('{title}', this.displayTitle())
      : this.t('tasks.board.toggleDone').replace('{title}', this.displayTitle()),
  );

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected ariaMoveTo(bucket: Bucket): string {
    const label = this.t(`tasks.board.bucket.${bucket}.title` as TranslationKey);
    return this.t('tasks.board.moveAria')
      .replace('{title}', this.displayTitle())
      .replace('{bucket}', label);
  }

  protected onSpace(event: Event): void {
    event.preventDefault();
    this.open.emit(this.entry().summary.id);
  }

  protected onToggleClick(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.toggleDone.emit(this.entry().summary.id);
  }

  protected onDeleteClick(event: MouseEvent): void {
    event.stopPropagation();
    this.remove.emit(this.entry().summary.id);
  }

  protected onMoveClick(event: MouseEvent, bucket: Bucket): void {
    event.stopPropagation();
    this.move.emit({ id: this.entry().summary.id, bucket });
  }
}

const MONTHS_ES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

const formatShort = (iso: string): string => {
  const [, m, d] = iso.split('-');
  const monthIdx = Number(m) - 1;
  return `${Number(d)} ${MONTHS_ES[monthIdx] ?? m}`;
};
