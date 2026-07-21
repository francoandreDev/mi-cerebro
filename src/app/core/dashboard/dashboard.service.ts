import { Injectable, computed, inject, signal } from '@angular/core';

import { ContinuityService } from '@core/continuity/continuity.service';
import { SearchIndexService } from '@core/search/search-index.service';
import { SettingsService } from '@core/settings/settings.service';
import { BooksService } from '@features/books/services/books.service';
import { isGoalDormant } from '@features/goals/models/goal.types';
import { GoalsService } from '@features/goals/services/goals.service';
import { LIST_KIND } from '@features/lists/models/list.types';
import { ListsService } from '@features/lists/services/lists.service';
import { NOTE_KIND } from '@features/notes/models/note.types';
import { NotesService } from '@features/notes/services/notes.service';
import { RemindersService } from '@features/reminders/services/reminders.service';
import { TasksService } from '@features/tasks/services/tasks.service';
import { WRITING_KIND } from '@features/writings/models/writing.types';
import { WritingsService } from '@features/writings/services/writings.service';

import {
  mergeRecentEntries,
  mergeResurfacePool,
  resolveContinuityEntry,
  selectActiveGoals,
  selectRelatedEntries,
  selectResurfaceEntries,
  selectTodayTasks,
  selectUpcomingReminders,
  DASHBOARD_RESURFACE_LIMIT,
  DASHBOARD_RESURFACE_STALE_DAYS,
} from './dashboard-filters';
import { loadResurfaceExcluded, saveResurfaceExcluded } from './dashboard-resurface-storage';
import type {
  DashboardGoalItem,
  DashboardRecentEntry,
  DashboardReminderItem,
  DashboardResurfaceMode,
  DashboardTaskItem,
} from './dashboard.types';

const RELATED_CANDIDATE_KINDS = [NOTE_KIND, WRITING_KIND, LIST_KIND];

const todayIso = (): string => new Date().toISOString().slice(0, 10);

// why: lives in core/ instead of features/dashboard to expose a read-only
//      aggregation of several features' summaries without making dashboard
//      import a sibling feature (§4.2 regla 10). Mirrors CalendarEventsService.
//      Widgets consume the DashboardXItem view types (dashboard.types.ts),
//      never the raw feature summaries, so features/dashboard/** stays
//      clear of the no-restricted-imports rule 10 lint gate.
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly tasks = inject(TasksService);
  private readonly goals = inject(GoalsService);
  private readonly reminders = inject(RemindersService);
  private readonly notes = inject(NotesService);
  private readonly writings = inject(WritingsService);
  private readonly lists = inject(ListsService);
  private readonly books = inject(BooksService);
  private readonly settings = inject(SettingsService);
  private readonly search = inject(SearchIndexService);
  private readonly continuity = inject(ContinuityService);

  // why: persisted in localStorage (dashboard-resurface-storage.ts), keyed
  //      by entity id -> the ms timestamp it was first excluded, so a TTL
  //      re-check on load doesn't reset entries that survived a previous
  //      session. Map, not Set, so re-saving on every shuffle/dismiss keeps
  //      each entry's original timestamp instead of bumping it to "now".
  private readonly resurfaceExcluded = signal<ReadonlyMap<string, number>>(
    loadResurfaceExcluded(Date.now(), DASHBOARD_RESURFACE_STALE_DAYS),
  );
  private readonly resurfaceModeSignal = signal<DashboardResurfaceMode>('random');
  readonly resurfaceMode = this.resurfaceModeSignal.asReadonly();

  readonly todayTasks = computed<readonly DashboardTaskItem[]>(() => {
    const today = todayIso();
    return selectTodayTasks(this.tasks.summaries(), new Date()).map((t) => {
      const dueDate = t.dueDates[0] ?? null;
      return {
        id: t.id,
        title: t.title,
        dueDate,
        overdue: dueDate !== null && dueDate.slice(0, 10) < today,
        tags: t.tags,
      };
    });
  });

  readonly activeGoals = computed<readonly DashboardGoalItem[]>(() => {
    const thresholdDays = this.settings.state().goals.dormantThresholdDays;
    const now = Date.now();
    return selectActiveGoals(this.goals.summaries(), new Date()).map((g) => ({
      id: g.id,
      title: g.title,
      deadline: g.deadline,
      stepsDone: g.stepsDone,
      stepsTotal: g.stepsTotal,
      tags: g.tags,
      dormant: isGoalDormant(g.completed, g.lastProgressAt, thresholdDays, now),
    }));
  });

  readonly upcomingReminders = computed<readonly DashboardReminderItem[]>(() =>
    selectUpcomingReminders(this.reminders.summaries()).map((r) => ({
      id: r.id,
      title: r.title,
      nextPingAt: r.nextPingAt,
    })),
  );

  readonly recentEntries = computed(() =>
    mergeRecentEntries(this.notes.summaries(), this.writings.summaries()),
  );

  private readonly resurfacePool = computed<readonly DashboardRecentEntry[]>(() =>
    mergeResurfacePool(
      this.notes.summaries(),
      this.writings.summaries(),
      this.lists.summaries(),
      this.books.chaptersIndex(),
    ),
  );

  // why: the entity the user was on right before /dashboard, resolved
  //      against the same pool "related" mode searches over — null (no
  //      context) is what makes the widget hide the toggle instead of
  //      showing a mode that would just silently do nothing.
  private readonly continuityEntry = computed(() =>
    resolveContinuityEntry(this.continuity.getPreviousRoute(), this.resurfacePool()),
  );
  readonly resurfaceRelatedAvailable = computed(() => this.continuityEntry() !== null);

  readonly resurfaceEntries = computed<readonly DashboardRecentEntry[]>(() => {
    const pool = this.resurfacePool();
    if (this.resurfaceModeSignal() === 'related') {
      const ctx = this.continuityEntry();
      if (ctx) {
        const hits = this.search.query({
          text: `${ctx.title} ${ctx.preview}`,
          kinds: RELATED_CANDIDATE_KINDS,
          limit: DASHBOARD_RESURFACE_LIMIT + 1,
          // why: OR, not the default AND — a whole-paragraph query needs any
          //      shared word to count, not all of them (see SearchQuery).
          combineWith: 'OR',
        });
        return selectRelatedEntries(pool, hits, ctx.id, DASHBOARD_RESURFACE_LIMIT);
      }
    }
    return selectResurfaceEntries(pool, new Set(this.resurfaceExcluded().keys()), new Date());
  });

  setResurfaceMode(mode: DashboardResurfaceMode): void {
    this.resurfaceModeSignal.set(mode);
  }

  // why: dispatched once per /dashboard visit (see DashboardContainer) —
  //      cheap no-op on repeat calls within the same session, since
  //      BooksService dedupes behind an in-flight promise. Returns the
  //      promise (rather than swallowing it with `void`) so the caller can
  //      route a rejection — e.g. a dropped FS permission surfacing as an
  //      AppError from BooksService.chaptersDir/readBook — through
  //      ErrorService instead of it becoming a silent unhandled rejection.
  //      Unlike books.refresh() at boot (which entity-ready.guard.ts
  //      deliberately lets fail silently because the container's own read
  //      shows the real error — see that guard's comment), nothing else
  //      ever calls ensureChaptersIndexLoaded, so no other layer catches
  //      this one.
  ensureChaptersIndexLoaded(): Promise<void> {
    return this.books.ensureChaptersIndexLoaded();
  }

  // why: excluye lo mostrado antes de recomputar, para que el próximo pick
  //      no repita salvo que el pool elegible se haya agotado (ver
  //      selectResurfaceEntries). No-op in 'related' mode: those results
  //      come from search relevance, not the exclusion pool.
  reshuffleResurface(): void {
    if (this.resurfaceModeSignal() === 'related') return;
    const shown = this.resurfaceEntries().map((e) => e.id);
    this.excludeIds(shown);
  }

  // why: shared by reshuffle (bulk) and the widget's per-row dismiss button
  //      (single id) — same persisted store, same TTL, no separate
  //      "snooze" concept (see dashboard-evolution.md decision log).
  dismissResurfaceEntry(id: string): void {
    this.excludeIds([id]);
  }

  private excludeIds(ids: readonly string[]): void {
    const now = Date.now();
    const next = new Map(this.resurfaceExcluded());
    for (const id of ids) if (!next.has(id)) next.set(id, now);
    this.resurfaceExcluded.set(next);
    saveResurfaceExcluded(next);
  }
}
