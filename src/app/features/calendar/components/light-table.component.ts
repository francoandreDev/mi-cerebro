import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import {
  ALL_CALENDAR_KINDS,
  type CalendarEvent,
  type CalendarEventKind,
} from '@core/calendar/calendar-event.types';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { MC_INTERNAL_DND_TYPE, hasInternalDnd } from '@shared/utils/dnd';

import { WEEKDAY_SHORT_ES, buildMonthGrid, todayIso } from '../utils/calendar-dates';

export interface TaskRescheduled {
  readonly taskId: string;
  readonly fromIso: string;
  readonly toIso: string;
}

// why: one CSS custom property per kind so both the day-cell sheets and the
//      legend swatches stay in sync from a single source — adding a 5th
//      kind later only means one new entry here.
const KIND_COLOR: Record<CalendarEventKind, string> = {
  goal: 'var(--mc-warn, #d4a847)',
  reminder: 'var(--mc-danger, #d04a4a)',
  task: 'var(--mc-accent-primary)',
  note: 'var(--mc-note, #8a7ad1)',
};

interface DayLayers {
  readonly iso: string;
  readonly day: number;
  readonly inMonth: boolean;
  readonly isWeekend: boolean;
  readonly sheets: readonly CalendarEventKind[];
}

@Component({
  selector: 'mc-calendar-light-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="light-table">
      <div class="glass">
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
              [class.drop-target]="dragOverIso() === cell.iso"
              (dragover)="onDragOver($event, cell.iso)"
              (dragleave)="onDragLeave($event, cell.iso)"
              (drop)="onDrop($event, cell.iso)"
            >
              <button type="button" class="day" (click)="pick.emit(cell.iso)">
                <span class="num">{{ cell.day }}</span>
                @if (cell.sheets.length > 0) {
                  <span class="acetate-stack">
                    @for (kind of cell.sheets; track kind) {
                      <span
                        class="sheet"
                        [style.background]="colorFor(kind)"
                        [title]="kindLabel(kind)"
                      ></span>
                    }
                  </span>
                }
              </button>
            </li>
          }
        </ol>
      </div>
      <div class="legend">
        @for (kind of kinds; track kind) {
          <button
            type="button"
            class="layer-toggle"
            [class.active]="kindFilter().has(kind)"
            (click)="toggleKind.emit(kind)"
            [attr.aria-pressed]="kindFilter().has(kind)"
          >
            <span class="swatch" [style.background]="colorFor(kind)"></span>
            {{ kindLabel(kind) }}
          </button>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-3);
      flex: 1;
    }
    .light-table {
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-3);
      flex: 1;
      padding: var(--mc-space-3);
      border-radius: var(--mc-radius-lg);
      background: linear-gradient(180deg, #5a4632, #3c2e20);
      box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.3);
    }
    .glass {
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-1);
      flex: 1;
      padding: var(--mc-space-3);
      border-radius: var(--mc-radius-md);
      background: radial-gradient(
        ellipse at center,
        color-mix(in srgb, var(--mc-accent-primary) 8%, var(--mc-bg-surface)) 0%,
        var(--mc-bg-surface) 75%
      );
      box-shadow:
        inset 0 0 24px rgba(255, 255, 255, 0.04),
        inset 0 0 0 1px rgba(255, 255, 255, 0.06);
    }
    .weekdays {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
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
      grid-template-columns: repeat(7, minmax(0, 1fr));
      grid-auto-rows: 1fr;
      gap: 2px;
      flex: 1;
      min-height: 320px;
    }
    .cell {
      background: color-mix(in srgb, var(--mc-bg-surface) 60%, transparent);
      border-radius: var(--mc-radius-sm);
      overflow: hidden;
    }
    .cell.out {
      opacity: 0.3;
    }
    .cell.weekend {
      background: color-mix(in srgb, var(--mc-bg-base) 60%, transparent);
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
    .cell.drop-target {
      outline: 2px dashed var(--mc-accent-primary);
      outline-offset: -2px;
      background: color-mix(in srgb, var(--mc-accent-primary) 18%, var(--mc-bg-surface));
    }
    .day {
      display: flex;
      flex-direction: column;
      gap: 4px;
      align-items: flex-start;
      width: 100%;
      height: 100%;
      min-width: 0;
      padding: 4px 6px;
      background: transparent;
      border: 0;
      cursor: pointer;
      color: var(--mc-fg-primary);
      text-align: left;
    }
    @media (max-width: 480px) {
      .light-table,
      .glass {
        padding: var(--mc-space-2);
      }
      .day {
        padding: 2px 3px;
      }
      .num {
        padding: 2px 4px;
      }
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
    .acetate-stack {
      display: flex;
      flex-direction: column;
      gap: 2px;
      width: 100%;
    }
    .sheet {
      display: block;
      height: 4px;
      width: 100%;
      border-radius: 2px;
      opacity: 0.75;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: var(--mc-space-2);
    }
    .layer-toggle {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--mc-bg-surface);
      border: 1px solid var(--mc-border-default);
      color: var(--mc-fg-muted);
      padding: var(--mc-space-1) var(--mc-space-3);
      border-radius: var(--mc-radius-pill);
      cursor: pointer;
      font-size: var(--mc-font-size-sm);
      opacity: 0.55;
    }
    .layer-toggle.active {
      color: var(--mc-fg-primary);
      opacity: 1;
    }
    .swatch {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
  `,
})
export class CalendarLightTableComponent {
  readonly year = input.required<number>();
  readonly month = input.required<number>();
  readonly selected = input<string | null>(null);
  readonly events = input<readonly CalendarEvent[]>([]);
  readonly kindFilter = input.required<ReadonlySet<CalendarEventKind>>();
  readonly pick = output<string>();
  readonly toggleKind = output<CalendarEventKind>();
  readonly taskRescheduled = output<TaskRescheduled>();

  private readonly i18n = inject(I18nService);

  protected readonly today = todayIso();
  protected readonly weekdays = WEEKDAY_SHORT_ES;
  protected readonly kinds = ALL_CALENDAR_KINDS;
  protected readonly dragOverIso = signal<string | null>(null);

  private readonly kindsByDay = computed<ReadonlyMap<string, readonly CalendarEventKind[]>>(() => {
    const map = new Map<string, CalendarEventKind[]>();
    for (const e of this.events()) {
      const bucket = map.get(e.date) ?? [];
      if (!bucket.includes(e.kind)) bucket.push(e.kind);
      map.set(e.date, bucket);
    }
    return map;
  });

  protected readonly cells = computed<readonly DayLayers[]>(() => {
    const byDay = this.kindsByDay();
    return buildMonthGrid(this.year(), this.month()).map((cell) => ({
      ...cell,
      sheets: byDay.get(cell.iso) ?? [],
    }));
  });

  protected colorFor(kind: CalendarEventKind): string {
    return KIND_COLOR[kind];
  }

  protected kindLabel(kind: CalendarEventKind): string {
    return this.i18n.t(`calendar.kind.${kind}` as TranslationKey);
  }

  protected onDragOver(event: DragEvent, iso: string): void {
    if (!hasInternalDnd(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    if (this.dragOverIso() !== iso) this.dragOverIso.set(iso);
  }

  // why: dragleave fires when the pointer crosses onto a child element (the
  //      day <button>) too, not just when it truly exits the cell — checking
  //      relatedTarget containment avoids the highlight flickering off while
  //      still hovering the same cell (same fix as DndController's depth
  //      counter, simplified for a single always-on-top target per cell).
  protected onDragLeave(event: DragEvent, iso: string): void {
    const cell = event.currentTarget as HTMLElement;
    const related = event.relatedTarget as Node | null;
    if (related && cell.contains(related)) return;
    if (this.dragOverIso() === iso) this.dragOverIso.set(null);
  }

  protected onDrop(event: DragEvent, toIso: string): void {
    if (!hasInternalDnd(event)) return;
    event.preventDefault();
    this.dragOverIso.set(null);
    const payload = event.dataTransfer?.getData(MC_INTERNAL_DND_TYPE);
    if (!payload) return;
    const [taskId, fromIso] = payload.split('::');
    if (!taskId || !fromIso || fromIso === toIso) return;
    this.taskRescheduled.emit({ taskId, fromIso, toIso });
  }
}
