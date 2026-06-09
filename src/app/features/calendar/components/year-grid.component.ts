import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type { CalendarEvent } from '@core/calendar/calendar-event.types';

import { MONTH_NAMES_ES, buildMonthGrid, todayIso } from '../utils/calendar-dates';

interface MiniMonth {
  readonly month: number;
  readonly name: string;
  readonly cells: readonly { iso: string; day: number; inMonth: boolean; hasEvents: boolean }[];
}

@Component({
  selector: 'mc-calendar-year-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="grid">
      @for (m of miniMonths(); track m.month) {
        <li class="mini">
          <button type="button" class="title" (click)="openMonth.emit(m.month)">
            {{ m.name }}
          </button>
          <ol class="days">
            @for (c of m.cells; track c.iso) {
              <li
                class="cell"
                [class.out]="!c.inMonth"
                [class.today]="c.iso === today"
                [class.has-events]="c.hasEvents"
              >
                <button type="button" (click)="pick.emit(c.iso)">{{ c.day }}</button>
              </li>
            }
          </ol>
        </li>
      }
    </ol>
  `,
  styles: `
    :host {
      display: block;
      flex: 1;
      overflow-y: auto;
    }
    .grid {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: var(--mc-space-3);
    }
    .mini {
      background: var(--mc-bg-surface);
      border-radius: var(--mc-radius-md);
      padding: var(--mc-space-2);
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-1);
    }
    .title {
      background: transparent;
      border: 0;
      color: var(--mc-fg-primary);
      font-weight: 600;
      text-align: left;
      cursor: pointer;
      padding: 2px 4px;
      border-radius: var(--mc-radius-sm);
    }
    .title:hover {
      background: var(--mc-bg-hover);
    }
    .days {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 2px;
    }
    .cell {
      aspect-ratio: 1;
    }
    .cell button {
      width: 100%;
      height: 100%;
      background: transparent;
      border: 0;
      color: var(--mc-fg-primary);
      font-size: 11px;
      cursor: pointer;
      border-radius: var(--mc-radius-sm);
      padding: 0;
    }
    .cell button:hover {
      background: var(--mc-bg-hover);
    }
    .cell.out button {
      color: var(--mc-fg-dim);
    }
    .cell.has-events button {
      background: var(--mc-bg-selected);
      color: var(--mc-fg-primary);
    }
    .cell.today button {
      background: var(--mc-accent-primary);
      color: var(--mc-accent-fg);
    }
  `,
})
export class CalendarYearGridComponent {
  readonly year = input.required<number>();
  readonly events = input<readonly CalendarEvent[]>([]);
  readonly pick = output<string>();
  readonly openMonth = output<number>();

  protected readonly today = todayIso();

  private readonly eventDates = computed<ReadonlySet<string>>(() => {
    const set = new Set<string>();
    for (const e of this.events()) set.add(e.date);
    return set;
  });

  protected readonly miniMonths = computed<readonly MiniMonth[]>(() => {
    const y = this.year();
    const dates = this.eventDates();
    const out: MiniMonth[] = [];
    for (let m = 0; m < 12; m++) {
      const grid = buildMonthGrid(y, m);
      out.push({
        month: m,
        name: MONTH_NAMES_ES[m]!,
        cells: grid.map((c) => ({
          iso: c.iso,
          day: c.day,
          inMonth: c.inMonth,
          hasEvents: c.inMonth && dates.has(c.iso),
        })),
      });
    }
    return out;
  });
}
