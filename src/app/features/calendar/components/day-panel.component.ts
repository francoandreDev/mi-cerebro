import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import type { CalendarEvent, CalendarEventKind } from '@core/calendar/calendar-event.types';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { IconComponent } from '@shared/icon/icon.component';
import type { IconName } from '@shared/icon/icons.data';

interface KindGroup {
  readonly kind: CalendarEventKind;
  readonly events: readonly CalendarEvent[];
}

@Component({
  selector: 'mc-calendar-day-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <header>
      <h3>
        <mc-icon name="calendar-blank" class="head-icon" />
        {{ heading() }}
      </h3>
      <div class="actions">
        <button type="button" class="primary" (click)="createTask.emit()">
          <mc-icon name="check-square" />
          {{ t('calendar.day.newTask') }}
        </button>
        <button type="button" class="primary" (click)="createGoal.emit()">
          <mc-icon name="target" />
          {{ t('calendar.day.newGoal') }}
        </button>
        <button type="button" class="primary" (click)="createReminder.emit()">
          <mc-icon name="bell" />
          {{ t('calendar.day.newReminder') }}
        </button>
      </div>
    </header>
    @if (groups().length === 0) {
      <div class="empty">
        <mc-icon name="calendar-blank" class="empty-icon mc-anim-float" />
        <p>{{ t('calendar.day.empty') }}</p>
      </div>
    } @else {
      @for (g of groups(); track g.kind) {
        <section class="group" [attr.data-kind]="g.kind">
          <h4>
            <mc-icon [name]="kindIcon(g.kind)" />
            {{ kindLabel(g.kind) }} <span class="count">({{ g.events.length }})</span>
          </h4>
          <ul>
            @for (e of g.events; track e.id) {
              <li class="mc-anim-slide-up" [class.done]="e.done">
                <button type="button" (click)="open.emit(e)">
                  <mc-icon [name]="e.done ? 'check' : 'dot-outline'" class="bullet" />
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
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .head-icon {
      color: var(--mc-accent-primary);
      margin-right: 4px;
    }
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--mc-space-2);
      color: var(--mc-fg-muted);
      padding: var(--mc-space-3) 0;
    }
    .empty p {
      margin: 0;
    }
    .empty-icon {
      font-size: 2.5rem;
      color: var(--mc-accent-primary);
      opacity: 0.55;
    }
    .group h4 {
      margin: 0 0 var(--mc-space-1);
      font-size: var(--mc-font-size-sm);
      color: var(--mc-fg-muted);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .group[data-kind='task'] h4 mc-icon {
      color: var(--mc-accent-primary);
    }
    .group[data-kind='goal'] h4 mc-icon {
      color: var(--mc-warn, #d4a847);
    }
    .group[data-kind='reminder'] h4 mc-icon {
      color: var(--mc-danger, #d04a4a);
    }
    .group[data-kind='note'] h4 mc-icon {
      color: var(--mc-note, #8a7ad1);
    }
    .count {
      color: var(--mc-fg-muted);
      font-size: var(--mc-font-size-xs);
    }
    .bullet {
      color: var(--mc-fg-muted);
      font-size: 0.85em;
      margin-right: 4px;
    }
    li.done .bullet {
      color: var(--mc-success, #4caf7a);
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
  readonly createReminder = output<void>();

  private readonly i18n = inject(I18nService);

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected heading(): string {
    return this.t('calendar.day.heading').replace('{date}', this.date());
  }

  protected kindIcon(kind: CalendarEventKind): IconName {
    if (kind === 'task') return 'check-square';
    if (kind === 'goal') return 'target';
    if (kind === 'note') return 'note';
    return 'bell';
  }

  protected kindLabel(kind: CalendarEventKind): string {
    if (kind === 'task') return this.t('calendar.kind.task');
    if (kind === 'goal') return this.t('calendar.kind.goal');
    if (kind === 'note') return this.t('calendar.kind.note');
    return this.t('calendar.kind.reminder');
  }

  protected readonly groups = computed<readonly KindGroup[]>(() => {
    const map = new Map<CalendarEventKind, CalendarEvent[]>();
    for (const e of this.events()) {
      const bucket = map.get(e.kind) ?? [];
      bucket.push(e);
      map.set(e.kind, bucket);
    }
    const order: CalendarEventKind[] = ['task', 'goal', 'reminder', 'note'];
    return order.filter((k) => map.has(k)).map((k) => ({ kind: k, events: map.get(k) ?? [] }));
  });
}
