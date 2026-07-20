import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import type { CalendarEvent, CalendarEventKind } from '@core/calendar/calendar-event.types';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { IconComponent } from '@shared/icon/icon.component';
import type { IconName } from '@shared/icon/icons.data';
import { MC_INTERNAL_DND_TYPE } from '@shared/utils/dnd';

import { formatDayMonth } from '../utils/calendar-dates';

@Component({
  selector: 'mc-calendar-kind-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <header [attr.data-kind]="kind()">
      <button
        type="button"
        class="toggle"
        [attr.aria-expanded]="active()"
        (click)="toggleActive.emit()"
      >
        <mc-icon [name]="active() ? 'caret-down' : 'caret-right'" class="chev" />
        <mc-icon [name]="kindIcon()" class="kind-icon" />
        <span class="label">{{ kindLabel() }}</span>
        <span class="count">({{ events().length }})</span>
      </button>
      <button
        type="button"
        class="add mc-hover-grow"
        (click)="create.emit()"
        [attr.aria-label]="addLabel()"
      >
        <mc-icon name="plus" />
      </button>
    </header>
    @if (active()) {
      @if (events().length === 0) {
        <p class="empty">{{ t('calendar.day.empty') }}</p>
      } @else {
        <ul>
          @for (e of sorted(); track e.id) {
            <li
              class="mc-anim-slide-up"
              [class.done]="e.done"
              [attr.draggable]="kind() === 'task' ? 'true' : null"
              [attr.title]="kind() === 'task' ? t('calendar.day.dragToReschedule') : null"
              (dragstart)="onDragStart($event, e)"
            >
              <button type="button" (click)="openEvent.emit(e)">
                <mc-icon [name]="e.done ? 'check' : 'dot-outline'" class="bullet" />
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
      color: var(--mc-fg-muted);
    }
    .kind-icon {
      color: var(--mc-fg-muted);
    }
    header[data-kind='task'] .kind-icon {
      color: var(--mc-accent-primary);
    }
    header[data-kind='goal'] .kind-icon {
      color: var(--mc-warn, #d4a847);
    }
    header[data-kind='reminder'] .kind-icon {
      color: var(--mc-danger, #d04a4a);
    }
    header[data-kind='note'] .kind-icon {
      color: var(--mc-note, #8a7ad1);
    }
    .bullet {
      color: var(--mc-fg-muted);
      font-size: 0.85em;
    }
    li.done .bullet {
      color: var(--mc-success, #4caf7a);
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
      width: 24px;
      height: 24px;
      border-radius: var(--mc-radius-sm);
      display: inline-flex;
      align-items: center;
      justify-content: center;
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
    li[draggable='true'] {
      cursor: grab;
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
    if (k === 'note') return this.t('calendar.kind.note');
    return this.t('calendar.kind.reminder');
  }

  protected kindIcon(): IconName {
    const k = this.kind();
    if (k === 'task') return 'check-square';
    if (k === 'goal') return 'target';
    if (k === 'note') return 'note';
    return 'bell';
  }

  protected addLabel(): string {
    const k = this.kind();
    if (k === 'task') return this.t('calendar.day.newTask');
    if (k === 'goal') return this.t('calendar.day.newGoal');
    if (k === 'note') return this.t('calendar.day.newNote');
    return this.t('calendar.day.newReminder');
  }

  protected formatWhen(iso: string): string {
    return formatDayMonth(iso);
  }

  // why: only tasks can be dragged to reschedule (only they have a real,
  //      per-date `dueDates` array to move); the composite payload carries
  //      both the entity id and the specific date being moved, since a task
  //      can have several due dates and only one is being dragged.
  protected onDragStart(event: DragEvent, e: CalendarEvent): void {
    if (e.kind !== 'task' || !event.dataTransfer) return;
    const payload = `${e.entityId}::${e.date}`;
    event.dataTransfer.setData(MC_INTERNAL_DND_TYPE, payload);
    event.dataTransfer.setData('text/plain', payload);
    event.dataTransfer.effectAllowed = 'move';
  }
}
