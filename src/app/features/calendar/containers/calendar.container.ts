import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { CalendarEventsService } from '@core/calendar/calendar-events.service';
import {
  ALL_CALENDAR_KINDS,
  eventRoute,
  type CalendarEvent,
  type CalendarEventKind,
  type CalendarFilters,
} from '@core/calendar/calendar-event.types';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { TagsService } from '@core/tags/tags.service';
import { IconComponent } from '@shared/icon/icon.component';

import { CalendarDayModalComponent } from '../components/day-modal.component';
import { CalendarKindCardComponent } from '../components/kind-card.component';
import { CalendarMonthGridComponent } from '../components/month-grid.component';
import { CalendarTagFilterComponent } from '../components/tag-filter.component';
import { CalendarToolbarComponent } from '../components/toolbar.component';
import { CalendarYearGridComponent } from '../components/year-grid.component';
import { MONTH_NAMES_ES, addMonths, parseIsoDay, todayIso } from '../utils/calendar-dates';

type ViewMode = 'month' | 'year';

interface WallGroup {
  readonly kind: CalendarEventKind;
  readonly events: readonly CalendarEvent[];
}

@Component({
  selector: 'mc-calendar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CalendarMonthGridComponent,
    CalendarYearGridComponent,
    CalendarDayModalComponent,
    CalendarKindCardComponent,
    CalendarTagFilterComponent,
    CalendarToolbarComponent,
    IconComponent,
  ],
  templateUrl: './calendar.container.html',
  styleUrl: './calendar.container.css',
})
export class CalendarContainer {
  private readonly events = inject(CalendarEventsService);
  private readonly tagsService = inject(TagsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  protected readonly tags = this.tagsService.tags;
  protected readonly allEvents = this.events.events;

  // why: read query params via toSignal to feed computeds reactively rather
  //      than imperatively syncing on every navigation event.
  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  protected readonly view = computed<ViewMode>(() => {
    const v = this.params().get('view');
    return v === 'year' ? 'year' : 'month';
  });

  protected readonly cursor = computed<{ year: number; month: number; day: string | null }>(() => {
    const raw = this.params().get('cursor') ?? todayIso();
    const d = parseIsoDay(raw) ?? new Date();
    const dayParam = this.params().get('day');
    return { year: d.getFullYear(), month: d.getMonth(), day: dayParam };
  });

  protected readonly kindFilter = signal<ReadonlySet<CalendarEventKind>>(
    new Set(ALL_CALENDAR_KINDS),
  );
  protected readonly tagFilter = signal<ReadonlySet<string>>(new Set());
  // why: keep modal openness separate from `day` query param so filter-driven
  //      day changes (search, date picker, year→month drill) update the
  //      selection outline without popping the modal, and closing the modal
  //      doesn't wipe the selection.
  protected readonly modalOpen = signal(false);

  private readonly filters = computed<CalendarFilters>(() => ({
    kinds: this.kindFilter(),
    tagIds: this.tagFilter(),
  }));

  protected readonly visibleEvents = computed<readonly CalendarEvent[]>(() =>
    this.events.filter(this.events.events(), this.filters()),
  );

  // why: tag-only filter feeds the wallboard so collapsing a kind card hides
  //      its events from the grid but its own card still shows the full count
  //      for the period.
  private readonly tagFilteredEvents = computed<readonly CalendarEvent[]>(() =>
    this.events.filter(this.events.events(), {
      kinds: new Set(ALL_CALENDAR_KINDS),
      tagIds: this.tagFilter(),
    }),
  );

  protected readonly monthEvents = computed<readonly CalendarEvent[]>(() => {
    const { year, month } = this.cursor();
    const prefix = `${year}-${(month + 1).toString().padStart(2, '0')}`;
    return this.visibleEvents().filter((e) => e.date.startsWith(prefix));
  });

  protected readonly yearEvents = computed<readonly CalendarEvent[]>(() => {
    const { year } = this.cursor();
    const prefix = `${year}-`;
    return this.visibleEvents().filter((e) => e.date.startsWith(prefix));
  });

  protected readonly dayEvents = computed<readonly CalendarEvent[]>(() => {
    const day = this.cursor().day;
    if (!day) return [];
    return this.visibleEvents().filter((e) => e.date === day);
  });

  protected readonly wallGroups = computed<readonly WallGroup[]>(() => {
    const prefix = this.periodPrefix();
    const inPeriod = this.tagFilteredEvents().filter((e) => e.date.startsWith(prefix));
    return ALL_CALENDAR_KINDS.map((kind) => ({
      kind,
      events: inPeriod.filter((e) => e.kind === kind),
    }));
  });

  protected readonly periodLabel = computed<string>(() => {
    const { year, month } = this.cursor();
    if (this.view() === 'year') return year.toString();
    return `${MONTH_NAMES_ES[month]} ${year}`;
  });

  protected readonly monthOptions = MONTH_NAMES_ES.map((label, value) => ({ label, value }));

  protected readonly yearOptions = computed<readonly number[]>(() => {
    const years = new Set<number>();
    for (const e of this.allEvents()) {
      const y = Number(e.date.slice(0, 4));
      if (!Number.isNaN(y)) years.add(y);
    }
    years.add(this.cursor().year);
    years.add(new Date().getFullYear());
    return [...years].sort((a, b) => a - b);
  });

  private periodPrefix(): string {
    const { year, month } = this.cursor();
    if (this.view() === 'year') return `${year}-`;
    return `${year}-${(month + 1).toString().padStart(2, '0')}`;
  }

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected setView(view: ViewMode): void {
    void this.navigate({ view });
  }

  protected onPrev(): void {
    const { year, month } = this.cursor();
    if (this.view() === 'year') {
      void this.navigate({ cursor: `${year - 1}-01-01`, day: null });
    } else {
      const next = addMonths(year, month, -1);
      void this.navigate({ cursor: isoFirst(next.year, next.month), day: null });
    }
  }

  protected onNext(): void {
    const { year, month } = this.cursor();
    if (this.view() === 'year') {
      void this.navigate({ cursor: `${year + 1}-01-01`, day: null });
    } else {
      const next = addMonths(year, month, 1);
      void this.navigate({ cursor: isoFirst(next.year, next.month), day: null });
    }
  }

  protected onToday(): void {
    void this.navigate({ cursor: todayIso(), view: 'month', day: null });
  }

  protected onPickDay(iso: string): void {
    void this.navigate({ day: iso });
    this.modalOpen.set(true);
  }

  protected onSearchPick(event: CalendarEvent): void {
    void this.navigate({ view: 'month', cursor: event.date, day: event.date });
  }

  protected onMonthSelect(month: number): void {
    void this.navigate({ view: 'month', cursor: isoFirst(this.cursor().year, month), day: null });
  }

  protected onYearSelect(year: number): void {
    const { month } = this.cursor();
    void this.navigate({ cursor: isoFirst(year, month), day: null });
  }

  protected onPickDayFromToolbar(iso: string): void {
    void this.navigate({ view: 'month', cursor: iso, day: iso });
  }

  protected onCloseDay(): void {
    this.modalOpen.set(false);
  }

  protected onPickYearMonth(iso: string): void {
    void this.navigate({ view: 'month', cursor: iso, day: iso });
  }

  protected onOpenMonth(month: number): void {
    void this.navigate({ view: 'month', cursor: isoFirst(this.cursor().year, month), day: null });
  }

  protected onOpenEvent(event: CalendarEvent): void {
    void this.router.navigate(eventRoute(event));
  }

  protected onToggleKind(kind: CalendarEventKind): void {
    const next = new Set(this.kindFilter());
    if (next.has(kind)) next.delete(kind);
    else next.add(kind);
    this.kindFilter.set(next);
  }

  protected onToggleTag(tagId: string): void {
    const next = new Set(this.tagFilter());
    if (next.has(tagId)) next.delete(tagId);
    else next.add(tagId);
    this.tagFilter.set(next);
  }

  protected onClearTags(): void {
    this.tagFilter.set(new Set());
  }

  protected onCreateForKind(kind: CalendarEventKind): void {
    if (kind === 'task') void this.onCreateTask();
    else if (kind === 'goal') void this.onCreateGoal();
    else void this.onCreateReminder();
  }

  protected async onCreateTask(): Promise<void> {
    await this.router.navigate(['/tasks']);
  }

  protected async onCreateGoal(): Promise<void> {
    await this.router.navigate(['/goals']);
  }

  protected async onCreateReminder(): Promise<void> {
    await this.router.navigate(['/reminders']);
  }

  private async navigate(patch: {
    view?: ViewMode;
    cursor?: string;
    day?: string | null;
  }): Promise<void> {
    const queryParams: Record<string, string | null> = {};
    if (patch.view !== undefined) queryParams['view'] = patch.view;
    if (patch.cursor !== undefined) queryParams['cursor'] = patch.cursor;
    if (patch.day !== undefined) queryParams['day'] = patch.day;
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}

const isoFirst = (year: number, month: number): string =>
  `${year}-${(month + 1).toString().padStart(2, '0')}-01`;
