import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import type { CalendarEvent, CalendarEventKind } from '@core/calendar/calendar-event.types';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';

interface KindGroup {
  readonly kind: CalendarEventKind;
  readonly events: readonly CalendarEvent[];
}

@Component({
  selector: 'mc-calendar-day-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      <h3>{{ heading() }}</h3>
      <div class="actions">
        <button type="button" class="primary" (click)="createTask.emit()">
          + {{ t('calendar.day.newTask') }}
        </button>
        <button type="button" class="primary" (click)="createGoal.emit()">
          + {{ t('calendar.day.newGoal') }}
        </button>
      </div>
    </header>
    @if (groups().length === 0) {
      <p class="empty">{{ t('calendar.day.empty') }}</p>
    } @else {
      @for (g of groups(); track g.kind) {
        <section class="group">
          <h4>{{ kindLabel(g.kind) }} ({{ g.events.length }})</h4>
          <ul>
            @for (e of g.events; track e.id) {
              <li [class.done]="e.done">
                <button type="button" (click)="open.emit(e)">
                  {{ e.title || t('calendar.day.untitled') }}
                </button>
              </li>
            }
          </ul>
        </section>
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-3);
      padding: var(--mc-space-3);
      background: var(--mc-bg-surface);
      border-radius: var(--mc-radius-md);
      border: 1px solid var(--mc-border-default);
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--mc-space-3);
      flex-wrap: wrap;
    }
    h3 {
      margin: 0;
      font-size: var(--mc-font-size-md);
    }
    .actions {
      display: flex;
      gap: var(--mc-space-2);
    }
    .primary {
      background: var(--mc-accent-primary);
      color: var(--mc-accent-fg);
      border: 0;
      padding: var(--mc-space-1) var(--mc-space-2);
      border-radius: var(--mc-radius-md);
      cursor: pointer;
      font-size: var(--mc-font-size-sm);
    }
    .empty {
      color: var(--mc-fg-muted);
      margin: 0;
    }
    .group h4 {
      margin: 0 0 var(--mc-space-1);
      font-size: var(--mc-font-size-sm);
      color: var(--mc-fg-muted);
    }
    .group ul {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .group li button {
      width: 100%;
      text-align: left;
      background: transparent;
      border: 0;
      color: var(--mc-fg-primary);
      padding: var(--mc-space-1) var(--mc-space-2);
      cursor: pointer;
      border-radius: var(--mc-radius-sm);
    }
    .group li button:hover {
      background: var(--mc-bg-hover);
    }
    .group li.done button {
      text-decoration: line-through;
      color: var(--mc-fg-muted);
    }
  `,
})
export class CalendarDayPanelComponent {
  readonly date = input.required<string>();
  readonly events = input<readonly CalendarEvent[]>([]);
  readonly open = output<CalendarEvent>();
  readonly createTask = output<void>();
  readonly createGoal = output<void>();

  private readonly i18n = inject(I18nService);

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected heading(): string {
    return this.t('calendar.day.heading').replace('{date}', this.date());
  }

  protected kindLabel(kind: CalendarEventKind): string {
    return this.t(kind === 'task' ? 'calendar.kind.task' : 'calendar.kind.goal');
  }

  protected readonly groups = computed<readonly KindGroup[]>(() => {
    const map = new Map<CalendarEventKind, CalendarEvent[]>();
    for (const e of this.events()) {
      const bucket = map.get(e.kind) ?? [];
      bucket.push(e);
      map.set(e.kind, bucket);
    }
    const order: CalendarEventKind[] = ['task', 'goal'];
    return order.filter((k) => map.has(k)).map((k) => ({ kind: k, events: map.get(k) ?? [] }));
  });
}
