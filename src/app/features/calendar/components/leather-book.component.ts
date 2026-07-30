import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import type { CalendarEvent, CalendarEventKind } from '@core/calendar/calendar-event.types';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { IconComponent } from '@shared/icon/icon.component';
import type { IconName } from '@shared/icon/icons.data';

import { buildWeekDays, formatDayMonth, todayIso } from '../utils/calendar-dates';

const KIND_COLOR: Record<CalendarEventKind, string> = {
  goal: 'var(--mc-warn, #d4a847)',
  reminder: 'var(--mc-danger, #d04a4a)',
  task: 'var(--mc-accent-primary)',
  note: 'var(--mc-note, #8a7ad1)',
};

interface BookDay {
  readonly iso: string;
  readonly day: number;
  readonly weekday: string;
  readonly isWeekend: boolean;
  readonly isToday: boolean;
  readonly kinds: readonly CalendarEventKind[];
}

interface KindGroup {
  readonly kind: CalendarEventKind;
  readonly events: readonly CalendarEvent[];
}

@Component({
  selector: 'mc-calendar-leather-book',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="leather-book mc-anim-pop">
      <div class="spread">
        <div class="spine" aria-hidden="true"></div>
        <button
          type="button"
          class="x"
          data-tutorial="calendar-book-close"
          (click)="dismiss.emit()"
          [attr.aria-label]="t('calendar.book.close')"
        >
          <mc-icon name="x" />
        </button>

        <div class="page left">
          <header class="page-head" data-tutorial="calendar-book-nav">
            <button
              type="button"
              class="page-nav"
              (click)="prevWeek.emit()"
              [attr.aria-label]="t('calendar.nav.prev')"
            >
              <mc-icon name="caret-left" />
            </button>
            <h3>{{ weekHeading() }}</h3>
            <button
              type="button"
              class="page-nav"
              (click)="nextWeek.emit()"
              [attr.aria-label]="t('calendar.nav.next')"
            >
              <mc-icon name="caret-right" />
            </button>
          </header>
          <ol class="week-list" data-tutorial="calendar-book-days">
            @for (d of days(); track d.iso) {
              <li>
                <button
                  type="button"
                  class="day-row"
                  [class.today]="d.isToday"
                  [class.selected]="d.iso === selected()"
                  [class.weekend]="d.isWeekend"
                  (click)="pick.emit(d.iso)"
                >
                  <span class="weekday">{{ d.weekday }}</span>
                  <span class="num">{{ d.day }}</span>
                  <span class="pins">
                    @for (kind of d.kinds; track kind) {
                      <span class="pin" [style.background]="colorFor(kind)"></span>
                    }
                  </span>
                </button>
              </li>
            }
          </ol>
        </div>

        <div class="page right">
          <header class="page-head">
            <h3>{{ dayHeading() }}</h3>
            <div class="actions" data-tutorial="calendar-book-create">
              <button
                type="button"
                class="quill"
                (click)="createTask.emit()"
                [attr.aria-label]="t('calendar.day.newTask')"
              >
                <mc-icon name="check-square" />
              </button>
              <button
                type="button"
                class="quill"
                (click)="createGoal.emit()"
                [attr.aria-label]="t('calendar.day.newGoal')"
              >
                <mc-icon name="target" />
              </button>
              <button
                type="button"
                class="quill"
                (click)="createReminder.emit()"
                [attr.aria-label]="t('calendar.day.newReminder')"
              >
                <mc-icon name="bell" />
              </button>
              <button
                type="button"
                class="quill"
                (click)="createNote.emit()"
                [attr.aria-label]="t('calendar.day.newNote')"
              >
                <mc-icon name="note" />
              </button>
            </div>
          </header>
          @if (dayGroups().length === 0) {
            <p class="empty-page">{{ t('calendar.book.emptyDay') }}</p>
          } @else {
            <div class="entries">
              @for (g of dayGroups(); track g.kind) {
                @if (g.kind === 'reminder') {
                  <div class="postits">
                    @for (e of g.events; track e.id) {
                      <button type="button" class="postit" (click)="openEvent.emit(e)">
                        <mc-icon name="push-pin" class="pin-icon" />
                        {{ e.title || t('calendar.day.untitled') }}
                      </button>
                    }
                  </div>
                } @else {
                  <ul class="manuscript">
                    @for (e of g.events; track e.id) {
                      <li class="mc-anim-slide-up" [class.done]="e.done">
                        <button type="button" (click)="openEvent.emit(e)">
                          <mc-icon
                            [name]="kindIcon(g.kind)"
                            class="entry-icon"
                            [style.color]="colorFor(g.kind)"
                          />
                          {{ e.title || t('calendar.day.untitled') }}
                        </button>
                      </li>
                    }
                  </ul>
                }
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      --mc-book-paper-bg: var(--mc-bg-surface);
      --mc-book-paper-fg: var(--mc-fg-primary);
      --mc-book-paper-muted: var(--mc-fg-muted);
      --mc-book-paper-border: var(--mc-border-default);
      --mc-book-paper-accent: var(--mc-bg-elevated);
    }
    :host-context(:root[data-theme='light']) {
      --mc-book-paper-bg: #f7efdc;
      --mc-book-paper-fg: #2a1c0c;
      --mc-book-paper-muted: #6e5430;
      --mc-book-paper-border: rgba(110, 70, 30, 0.35);
      --mc-book-paper-accent: rgba(110, 70, 30, 0.08);
    }
    @media (prefers-color-scheme: light) {
      :host-context(:root:not([data-theme='dark'])) {
        --mc-book-paper-bg: #f7efdc;
        --mc-book-paper-fg: #2a1c0c;
        --mc-book-paper-muted: #6e5430;
        --mc-book-paper-border: rgba(110, 70, 30, 0.35);
        --mc-book-paper-accent: rgba(110, 70, 30, 0.08);
      }
    }
    .leather-book {
      padding: var(--mc-space-3);
      border-radius: var(--mc-radius-lg);
      background: linear-gradient(160deg, #6b3f2a, #3d2415);
      box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.3);
    }
    .spread {
      position: relative;
      min-height: min(70vh, 640px);
      display: grid;
      grid-template-columns: 1fr 1fr;
      background: var(--mc-book-paper-bg);
      color: var(--mc-book-paper-fg);
      border-radius: 4px;
      box-shadow:
        0 1px 1px rgba(0, 0, 0, 0.15),
        0 14px 36px rgba(0, 0, 0, 0.32);
      overflow: hidden;
      font-family: var(--mc-font-serif);
    }
    .spine {
      position: absolute;
      left: 50%;
      top: 0;
      bottom: 0;
      width: 28px;
      transform: translateX(-50%);
      background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(0, 0, 0, 0.08) 28%,
        rgba(0, 0, 0, 0.24) 50%,
        rgba(0, 0, 0, 0.08) 72%,
        transparent 100%
      );
      pointer-events: none;
      z-index: 3;
    }
    .x {
      position: absolute;
      top: var(--mc-space-2);
      right: var(--mc-space-2);
      z-index: 4;
      background: transparent;
      border: 0;
      color: var(--mc-book-paper-muted);
      cursor: pointer;
      font-size: var(--mc-font-size-lg);
      line-height: 1;
    }
    .x:hover {
      color: var(--mc-book-paper-fg);
    }
    .page {
      position: relative;
      padding: clamp(24px, 4vh, 40px) clamp(20px, 3.5vw, 40px);
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      overflow: auto;
    }
    .page.left {
      padding-right: clamp(28px, 4vw, 52px);
    }
    .page.right {
      padding-left: clamp(28px, 4vw, 52px);
    }
    .page-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--mc-space-2);
      border-bottom: 1px solid var(--mc-book-paper-border);
      padding-bottom: var(--mc-space-2);
      margin-bottom: var(--mc-space-3);
    }
    .page-head h3 {
      margin: 0;
      font-family: var(--mc-font-serif);
      font-variant: small-caps;
      font-size: 1.1rem;
      letter-spacing: 0.06em;
      color: var(--mc-book-paper-fg);
    }
    .page-nav {
      background: transparent;
      border: 0;
      color: var(--mc-book-paper-muted);
      cursor: pointer;
      display: grid;
      place-items: center;
      padding: 2px;
    }
    .page-nav:hover {
      color: var(--mc-book-paper-fg);
    }
    .week-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .day-row {
      display: flex;
      align-items: center;
      gap: var(--mc-space-2);
      width: 100%;
      background: transparent;
      border: 0;
      border-bottom: 1px dashed var(--mc-book-paper-border);
      padding: var(--mc-space-2) var(--mc-space-1);
      cursor: pointer;
      color: var(--mc-book-paper-fg);
      text-align: left;
      font-family: var(--mc-font-serif);
    }
    .day-row:hover {
      background: var(--mc-book-paper-accent);
    }
    .day-row.selected {
      background: var(--mc-book-paper-accent);
      box-shadow: inset 3px 0 0 var(--mc-accent-primary);
    }
    .day-row.today .num {
      font-weight: 700;
      text-decoration: underline;
    }
    .day-row.weekend .weekday {
      color: var(--mc-danger, #d04a4a);
    }
    .weekday {
      font-variant: small-caps;
      color: var(--mc-book-paper-muted);
      width: 2ch;
    }
    .num {
      font-size: 1.1rem;
      width: 2.5ch;
    }
    .pins {
      display: flex;
      gap: 4px;
      flex: 1;
      justify-content: flex-end;
    }
    .pin {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      opacity: 0.85;
    }
    .actions {
      display: flex;
      gap: 6px;
    }
    .quill {
      background: transparent;
      border: 1px solid var(--mc-book-paper-border);
      color: var(--mc-book-paper-muted);
      border-radius: var(--mc-radius-sm);
      padding: 4px 6px;
      cursor: pointer;
      display: grid;
      place-items: center;
    }
    .quill:hover {
      color: var(--mc-book-paper-fg);
      border-color: var(--mc-book-paper-fg);
    }
    .empty-page {
      color: var(--mc-book-paper-muted);
      font-style: italic;
    }
    .entries {
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-3);
    }
    .manuscript {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .manuscript li button {
      width: 100%;
      text-align: left;
      background: transparent;
      border: 0;
      border-bottom: 1px dashed var(--mc-book-paper-border);
      color: var(--mc-book-paper-fg);
      font-family: var(--mc-font-serif);
      font-style: italic;
      font-size: 1.05rem;
      padding: 6px 4px;
      cursor: pointer;
    }
    .manuscript li button:hover {
      background: var(--mc-book-paper-accent);
    }
    .manuscript li.done button {
      text-decoration: line-through;
      color: var(--mc-book-paper-muted);
    }
    .entry-icon {
      margin-right: 6px;
    }
    .postits {
      display: flex;
      flex-wrap: wrap;
      gap: var(--mc-space-2);
    }
    .postit {
      background: #f6dd6b;
      color: #4a3c0a;
      border: 0;
      border-radius: 2px;
      padding: var(--mc-space-2);
      max-width: 160px;
      font-family: var(--mc-font-serif);
      font-size: var(--mc-font-size-sm);
      text-align: left;
      cursor: pointer;
      box-shadow: 2px 3px 6px rgba(0, 0, 0, 0.25);
      transform: rotate(-2deg);
    }
    .postit:nth-child(even) {
      transform: rotate(2deg);
      background: #f6c86b;
    }
    .postit:hover {
      transform: rotate(0deg) scale(1.03);
    }
    .pin-icon {
      display: block;
      margin-bottom: 4px;
    }
  `,
})
export class CalendarLeatherBookComponent {
  readonly weekStart = input.required<string>();
  readonly selected = input<string | null>(null);
  readonly events = input<readonly CalendarEvent[]>([]);
  readonly pick = output<string>();
  readonly prevWeek = output<void>();
  readonly nextWeek = output<void>();
  readonly dismiss = output<void>();
  readonly openEvent = output<CalendarEvent>();
  readonly createTask = output<void>();
  readonly createGoal = output<void>();
  readonly createReminder = output<void>();
  readonly createNote = output<void>();

  private readonly i18n = inject(I18nService);
  private readonly today = todayIso();

  private readonly eventsByDay = computed<ReadonlyMap<string, readonly CalendarEvent[]>>(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of this.events()) {
      const bucket = map.get(e.date) ?? [];
      bucket.push(e);
      map.set(e.date, bucket);
    }
    return map;
  });

  protected readonly days = computed<readonly BookDay[]>(() => {
    const byDay = this.eventsByDay();
    return buildWeekDays(this.weekStart()).map((d) => ({
      ...d,
      isToday: d.iso === this.today,
      kinds: [...new Set((byDay.get(d.iso) ?? []).map((e) => e.kind))],
    }));
  });

  protected readonly dayGroups = computed<readonly KindGroup[]>(() => {
    const day = this.selected();
    if (!day) return [];
    const inDay = this.events().filter((e) => e.date === day);
    const map = new Map<CalendarEventKind, CalendarEvent[]>();
    for (const e of inDay) {
      const bucket = map.get(e.kind) ?? [];
      bucket.push(e);
      map.set(e.kind, bucket);
    }
    const order: CalendarEventKind[] = ['task', 'goal', 'reminder', 'note'];
    return order.filter((k) => map.has(k)).map((k) => ({ kind: k, events: map.get(k) ?? [] }));
  });

  protected readonly weekHeading = computed<string>(() =>
    this.t('calendar.book.weekHeading').replace('{date}', formatDayMonth(this.weekStart())),
  );

  protected readonly dayHeading = computed<string>(() => {
    const day = this.selected();
    if (!day) return this.t('calendar.book.emptyDay');
    return this.t('calendar.day.heading').replace('{date}', day);
  });

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected colorFor(kind: CalendarEventKind): string {
    return KIND_COLOR[kind];
  }

  protected kindIcon(kind: CalendarEventKind): IconName {
    if (kind === 'task') return 'check-square';
    if (kind === 'goal') return 'target';
    if (kind === 'note') return 'note';
    return 'bell';
  }
}
