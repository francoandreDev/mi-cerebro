import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import type { CalendarEventKind } from '@core/calendar/calendar-event.types';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';

@Component({
  selector: 'mc-calendar-filters',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      <span class="label">{{ t('calendar.filters.kind') }}</span>
      <button
        type="button"
        class="chip"
        [class.active]="kinds().has('task')"
        (click)="toggleKind.emit('task')"
      >
        {{ t('calendar.kind.task') }}
      </button>
      <button
        type="button"
        class="chip"
        [class.active]="kinds().has('goal')"
        (click)="toggleKind.emit('goal')"
      >
        {{ t('calendar.kind.goal') }}
      </button>
      <button
        type="button"
        class="chip"
        [class.active]="kinds().has('reminder')"
        (click)="toggleKind.emit('reminder')"
      >
        {{ t('calendar.kind.reminder') }}
      </button>
    </div>
    @if (tags().length > 0) {
      <div class="row">
        <span class="label">{{ t('calendar.filters.tag') }}</span>
        @for (tag of tags(); track tag.id) {
          <button
            type="button"
            class="chip"
            [class.active]="tagIds().has(tag.id)"
            (click)="toggleTag.emit(tag.id)"
          >
            {{ tag.label }}
          </button>
        }
        @if (tagIds().size > 0) {
          <button type="button" class="ghost" (click)="clearTags.emit()">
            {{ t('calendar.filters.clear') }}
          </button>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-2);
    }
    .row {
      display: flex;
      gap: var(--mc-space-1);
      align-items: center;
      flex-wrap: wrap;
    }
    .label {
      color: var(--mc-fg-muted);
      font-size: var(--mc-font-size-xs);
      margin-right: var(--mc-space-1);
    }
    .chip {
      background: var(--mc-bg-elevated);
      color: var(--mc-fg-primary);
      border: 1px solid var(--mc-border-default);
      padding: 2px var(--mc-space-2);
      border-radius: var(--mc-radius-pill);
      cursor: pointer;
      font-size: var(--mc-font-size-xs);
    }
    .chip.active {
      background: var(--mc-accent-primary);
      color: var(--mc-accent-fg);
      border-color: var(--mc-accent-primary);
    }
    .ghost {
      background: transparent;
      border: 0;
      color: var(--mc-fg-muted);
      cursor: pointer;
      font-size: var(--mc-font-size-xs);
      text-decoration: underline;
    }
  `,
})
export class CalendarFiltersComponent {
  readonly kinds = input.required<ReadonlySet<CalendarEventKind>>();
  readonly tagIds = input.required<ReadonlySet<string>>();
  readonly tags = input<readonly Tag[]>([]);
  readonly toggleKind = output<CalendarEventKind>();
  readonly toggleTag = output<string>();
  readonly clearTags = output<void>();

  private readonly i18n = inject(I18nService);
  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }
}
