import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type { CalendarEvent, CalendarEventKind } from '@core/calendar/calendar-event.types';

import { WEEKDAY_SHORT_ES, buildMonthGrid, todayIso } from '../utils/calendar-dates';

interface CellSummary {
  readonly counts: Partial<Record<CalendarEventKind, number>>;
  readonly total: number;
}

@Component({
  selector: 'mc-calendar-month-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="weekdays" aria-hidden="true">
      @for (d of weekdays; track d) {
        <li>{{ d }}</li>
      }
    </ol>
    <ol class="grid">
      @for (cell of cells(); track cell.iso) {
        <li
          class="cell"
          [class.out]="!cell.inMonth"
          [class.weekend]="cell.isWeekend"
          [class.today]="cell.iso === today"
          [class.selected]="cell.iso === selected()"
        >
          <button type="button" class="day" (click)="pick.emit(cell.iso)">
            <span class="num">{{ cell.day }}</span>
            @if (summaries().get(cell.iso); as s) {
              <span class="dots">
                @if (s.counts.task) {
                  <span class="dot task" [title]="s.counts.task + ' tareas'">●</span>
                }
                @if (s.counts.goal) {
                  <span class="dot goal" [title]="s.counts.goal + ' metas'">●</span>
                }
              </span>
            }
          </button>
        </li>
      }
    </ol>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-1);
      flex: 1;
    }
    .weekdays {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 2px;
      color: var(--mc-fg-muted);
      font-size: var(--mc-font-size-xs);
      text-align: center;
    }
    .grid {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      grid-auto-rows: 1fr;
      gap: 2px;
      flex: 1;
      min-height: 320px;
    }
    .cell {
      background: var(--mc-bg-surface);
      border-radius: var(--mc-radius-sm);
      overflow: hidden;
    }
    .cell.out {
      opacity: 0.35;
    }
    .cell.weekend {
      background: var(--mc-bg-base);
    }
    .cell.today .num {
      background: var(--mc-accent-primary);
      color: var(--mc-accent-fg);
      font-weight: 700;
      box-shadow:
        0 0 0 2px var(--mc-bg-surface),
        0 0 0 3px var(--mc-accent-primary);
    }
    .cell.selected {
      outline: 3px solid var(--mc-accent-primary);
      outline-offset: -3px;
      background: color-mix(in srgb, var(--mc-accent-primary) 12%, var(--mc-bg-surface));
    }
    .cell.selected .num {
      font-weight: 700;
    }
    .day {
      display: flex;
      flex-direction: column;
      gap: 4px;
      align-items: flex-start;
      width: 100%;
      height: 100%;
      padding: 4px 6px;
      background: transparent;
      border: 0;
      cursor: pointer;
      color: var(--mc-fg-primary);
      text-align: left;
    }
    .day:hover {
      background: var(--mc-bg-hover);
    }
    .num {
      font-size: var(--mc-font-size-sm);
      padding: 2px 6px;
      border-radius: var(--mc-radius-pill);
      line-height: 1;
    }
    .dots {
      display: flex;
      gap: 2px;
    }
    .dot {
      font-size: 10px;
      line-height: 1;
    }
    .dot.task {
      color: var(--mc-state-info);
    }
    .dot.goal {
      color: var(--mc-accent-primary);
    }
  `,
})
export class CalendarMonthGridComponent {
  readonly year = input.required<number>();
  readonly month = input.required<number>();
  readonly selected = input<string | null>(null);
  readonly events = input<readonly CalendarEvent[]>([]);
  readonly pick = output<string>();

  protected readonly today = todayIso();
  protected readonly weekdays = WEEKDAY_SHORT_ES;

  protected readonly cells = computed(() => buildMonthGrid(this.year(), this.month()));

  protected readonly summaries = computed<ReadonlyMap<string, CellSummary>>(() => {
    const out = new Map<string, CellSummary>();
    for (const e of this.events()) {
      const prev = out.get(e.date);
      const counts: Partial<Record<CalendarEventKind, number>> = prev ? { ...prev.counts } : {};
      counts[e.kind] = (counts[e.kind] ?? 0) + 1;
      out.set(e.date, { counts, total: (prev?.total ?? 0) + 1 });
    }
    return out;
  });
}
