import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import type { CalendarEvent, CalendarEventKind } from '@core/calendar/calendar-event.types';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';

import { formatDayMonth } from '../utils/calendar-dates';

@Component({
  selector: 'mc-calendar-kind-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      <button
        type="button"
        class="toggle"
        [attr.aria-expanded]="active()"
        (click)="toggleActive.emit()"
      >
        <span class="chev" [class.open]="active()" aria-hidden="true">▸</span>
        <span class="label">{{ kindLabel() }}</span>
        <span class="count">({{ events().length }})</span>
      </button>
      <button type="button" class="add" (click)="create.emit()" [attr.aria-label]="addLabel()">
        +
      </button>
    </header>
    @if (active()) {
      @if (events().length === 0) {
        <p class="empty">{{ t('calendar.day.empty') }}</p>
      } @else {
        <ul>
          @for (e of sorted(); track e.id) {
            <li [class.done]="e.done">
              <button type="button" (click)="openEvent.emit(e)">
                <span class="when">{{ formatWhen(e.date) }}</span>
                <span class="title">{{ e.title || t('calendar.day.untitled') }}</span>
              </button>
            </li>
          }
        </ul>
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      background: var(--mc-bg-surface);
      border: 1px solid var(--mc-border-default);
      border-radius: var(--mc-radius-md);
      overflow: hidden;
    }
    header {
      display: flex;
      align-items: center;
      gap: var(--mc-space-2);
      padding: var(--mc-space-1) var(--mc-space-2);
    }
    .toggle {
      flex: 1;
      display: flex;
      align-items: center;
      gap: var(--mc-space-2);
      background: transparent;
      border: 0;
      cursor: pointer;
      color: var(--mc-fg-primary);
      padding: var(--mc-space-1) 0;
      font-size: var(--mc-font-size-sm);
      text-align: left;
    }
    .chev {
      display: inline-block;
      transition: transform 120ms ease;
      color: var(--mc-fg-muted);
      width: 1ch;
    }
    .chev.open {
      transform: rotate(90deg);
    }
    .label {
      font-weight: 600;
    }
    .count {
      color: var(--mc-fg-muted);
      font-size: var(--mc-font-size-xs);
    }
    .add {
      background: transparent;
      border: 1px solid var(--mc-border-default);
      color: var(--mc-fg-primary);
      cursor: pointer;
      width: 22px;
      height: 22px;
      border-radius: var(--mc-radius-sm);
      line-height: 1;
      font-size: var(--mc-font-size-sm);
    }
    .add:hover {
      background: var(--mc-bg-hover);
    }
    .empty {
      color: var(--mc-fg-muted);
      margin: 0;
      padding: 0 var(--mc-space-2) var(--mc-space-2);
      font-size: var(--mc-font-size-xs);
    }
    ul {
      list-style: none;
      padding: 0 var(--mc-space-1) var(--mc-space-1);
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    li button {
      width: 100%;
      display: flex;
      gap: var(--mc-space-2);
      align-items: baseline;
      text-align: left;
      background: transparent;
      border: 0;
      color: var(--mc-fg-primary);
      padding: var(--mc-space-1) var(--mc-space-2);
      cursor: pointer;
      border-radius: var(--mc-radius-sm);
      font-size: var(--mc-font-size-sm);
    }
    li button:hover {
      background: var(--mc-bg-hover);
    }
    li.done button {
      text-decoration: line-through;
      color: var(--mc-fg-muted);
    }
    .when {
      color: var(--mc-fg-muted);
      font-size: var(--mc-font-size-xs);
      font-variant-numeric: tabular-nums;
      min-width: 4ch;
    }
    .title {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
})
export class CalendarKindCardComponent {
  readonly kind = input.required<CalendarEventKind>();
  readonly events = input<readonly CalendarEvent[]>([]);
  readonly active = input.required<boolean>();
  readonly toggleActive = output<void>();
  readonly openEvent = output<CalendarEvent>();
  readonly create = output<void>();

  private readonly i18n = inject(I18nService);

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected readonly sorted = computed<readonly CalendarEvent[]>(() =>
    [...this.events()].sort((a, b) => a.date.localeCompare(b.date)),
  );

  protected kindLabel(): string {
    const k = this.kind();
    if (k === 'task') return this.t('calendar.kind.task');
    if (k === 'goal') return this.t('calendar.kind.goal');
    return this.t('calendar.kind.reminder');
  }

  protected addLabel(): string {
    const k = this.kind();
    if (k === 'task') return this.t('calendar.day.newTask');
    if (k === 'goal') return this.t('calendar.day.newGoal');
    return this.t('calendar.day.newReminder');
  }

  protected formatWhen(iso: string): string {
    return formatDayMonth(iso);
  }
}
