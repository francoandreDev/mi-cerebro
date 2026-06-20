import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import type { CalendarEvent } from '@core/calendar/calendar-event.types';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { IconComponent } from '@shared/icon/icon.component';
import type { IconName } from '@shared/icon/icons.data';

import { formatDayMonth, todayIso } from '../utils/calendar-dates';

const MAX_RESULTS = 8;

@Component({
  selector: 'mc-calendar-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="search">
      <mc-icon name="magnifying-glass" class="search-icon" />
      <input
        #q
        type="search"
        [placeholder]="t('calendar.search.placeholder')"
        [value]="query()"
        (input)="onQuery(q.value)"
        (focus)="focused.set(true)"
        (keydown.enter)="onEnter()"
      />
      @if (focused() && query().length > 0) {
        <div class="results" role="listbox">
          @if (results().length === 0) {
            <p class="empty">{{ t('calendar.search.empty') }}</p>
          } @else {
            <ul>
              @for (e of results(); track e.id) {
                <li>
                  <button type="button" (click)="onPick(e)">
                    <mc-icon [name]="kindIcon(e)" class="kind-icon" />
                    <span class="when">{{ formatWhen(e.date) }}</span>
                    <span class="title">{{ e.title || t('calendar.day.untitled') }}</span>
                    <span class="kind">{{ kindLabel(e) }}</span>
                  </button>
                </li>
              }
            </ul>
          }
        </div>
      }
    </div>

    <div class="day-picker">
      <mc-icon name="calendar-dots" class="picker-icon" />
      <input
        #d
        type="date"
        class="date-input"
        [value]="selectedDay() ?? today"
        (change)="onPickDay(d.value)"
        [attr.aria-label]="t('calendar.toolbar.goto')"
      />
      <button type="button" class="today-btn" (click)="pickToday.emit()">
        <mc-icon name="calendar-check" />
        {{ t('calendar.nav.today') }}
      </button>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      gap: var(--mc-space-2);
      align-items: center;
      flex-wrap: wrap;
    }
    .search {
      position: relative;
      flex: 1;
      min-width: 220px;
      max-width: 520px;
    }
    .search input {
      width: 100%;
      background: var(--mc-bg-surface);
      color: var(--mc-fg-primary);
      border: 1px solid var(--mc-border-default);
      border-radius: var(--mc-radius-md);
      padding: var(--mc-space-1) var(--mc-space-2) var(--mc-space-1) calc(var(--mc-space-2) + 1.4em);
      font-size: var(--mc-font-size-sm);
    }
    .search-icon {
      position: absolute;
      left: var(--mc-space-2);
      top: 50%;
      transform: translateY(-50%);
      color: var(--mc-fg-muted);
      pointer-events: none;
    }
    .kind-icon {
      color: var(--mc-fg-muted);
    }
    .picker-icon {
      color: var(--mc-fg-muted);
    }
    .today-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .results {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      z-index: 30;
      background: var(--mc-bg-base);
      border: 1px solid var(--mc-border-default);
      border-radius: var(--mc-radius-md);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
      max-height: 320px;
      overflow-y: auto;
    }
    .empty {
      color: var(--mc-fg-muted);
      font-size: var(--mc-font-size-xs);
      padding: var(--mc-space-2);
      margin: 0;
    }
    ul {
      list-style: none;
      padding: var(--mc-space-1);
      margin: 0;
    }
    li button {
      display: flex;
      align-items: baseline;
      gap: var(--mc-space-2);
      width: 100%;
      background: transparent;
      border: 0;
      color: var(--mc-fg-primary);
      padding: var(--mc-space-1) var(--mc-space-2);
      cursor: pointer;
      border-radius: var(--mc-radius-sm);
      font-size: var(--mc-font-size-sm);
      text-align: left;
    }
    li button:hover {
      background: var(--mc-bg-hover);
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
    .kind {
      color: var(--mc-fg-muted);
      font-size: var(--mc-font-size-xs);
    }
    .day-picker {
      display: inline-flex;
      gap: var(--mc-space-1);
      align-items: center;
    }
    .date-input {
      background: var(--mc-bg-surface);
      color: var(--mc-fg-primary);
      border: 1px solid var(--mc-border-default);
      border-radius: var(--mc-radius-sm);
      padding: var(--mc-space-1) var(--mc-space-2);
      font-size: var(--mc-font-size-sm);
      color-scheme: dark light;
    }
    .today-btn {
      background: transparent;
      color: var(--mc-fg-primary);
      border: 1px solid var(--mc-border-default);
      border-radius: var(--mc-radius-sm);
      padding: var(--mc-space-1) var(--mc-space-2);
      font-size: var(--mc-font-size-xs);
      cursor: pointer;
    }
    .today-btn:hover {
      background: var(--mc-bg-hover);
    }
  `,
})
export class CalendarToolbarComponent {
  readonly allEvents = input<readonly CalendarEvent[]>([]);
  readonly selectedDay = input<string | null>(null);
  readonly pickResult = output<CalendarEvent>();
  readonly pickDay = output<string>();
  readonly pickToday = output<void>();

  private readonly i18n = inject(I18nService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly today = todayIso();
  protected readonly query = signal('');
  protected readonly focused = signal(false);

  protected readonly results = computed<readonly CalendarEvent[]>(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return [];
    const matches: CalendarEvent[] = [];
    for (const e of this.allEvents()) {
      if (e.title.toLowerCase().includes(q)) {
        matches.push(e);
        if (matches.length >= MAX_RESULTS) break;
      }
    }
    return matches.sort((a, b) => a.date.localeCompare(b.date));
  });

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onQuery(value: string): void {
    this.query.set(value);
    this.focused.set(true);
  }

  protected onPick(event: CalendarEvent): void {
    this.pickResult.emit(event);
    this.query.set('');
    this.focused.set(false);
  }

  protected onEnter(): void {
    const first = this.results()[0];
    if (first) this.onPick(first);
  }

  protected onPickDay(value: string): void {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) this.pickDay.emit(value);
  }

  protected formatWhen(iso: string): string {
    return formatDayMonth(iso);
  }

  protected kindLabel(e: CalendarEvent): string {
    if (e.kind === 'task') return this.t('calendar.kind.task');
    if (e.kind === 'goal') return this.t('calendar.kind.goal');
    return this.t('calendar.kind.reminder');
  }

  protected kindIcon(e: CalendarEvent): IconName {
    if (e.kind === 'task') return 'check-square';
    if (e.kind === 'goal') return 'target';
    return 'bell';
  }

  @HostListener('document:click', ['$event'])
  protected onDocClick(event: MouseEvent): void {
    if (!this.focused()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.focused.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  protected onEsc(): void {
    if (this.focused()) this.focused.set(false);
  }
}
