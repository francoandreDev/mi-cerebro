import { Injectable, computed, inject, signal } from '@angular/core';

import { SettingsService } from '@core/settings/settings.service';
import { isGoalDormant } from '@features/goals/models/goal.types';
import { GoalsService } from '@features/goals/services/goals.service';
import { ListsService } from '@features/lists/services/lists.service';
import { NotesService } from '@features/notes/services/notes.service';
import { RemindersService } from '@features/reminders/services/reminders.service';
import { TasksService } from '@features/tasks/services/tasks.service';
import { WritingsService } from '@features/writings/services/writings.service';

import {
  mergeRecentEntries,
  mergeResurfacePool,
  selectActiveGoals,
  selectResurfaceEntries,
  selectTodayTasks,
  selectUpcomingReminders,
} from './dashboard-filters';
import type {
  DashboardGoalItem,
  DashboardRecentEntry,
  DashboardReminderItem,
  DashboardTaskItem,
} from './dashboard.types';

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
  private readonly settings = inject(SettingsService);

  // why: en memoria, no persistido — se resetea en cada carga de la app.
  //      Persistencia entre sesiones queda en docs/deferred.md.
  private readonly resurfaceExcluded = signal<ReadonlySet<string>>(new Set());

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

  readonly resurfaceEntries = computed<readonly DashboardRecentEntry[]>(() => {
    const pool = mergeResurfacePool(
      this.notes.summaries(),
      this.writings.summaries(),
      this.lists.summaries(),
    );
    return selectResurfaceEntries(pool, this.resurfaceExcluded(), new Date());
  });

  // why: excluye lo mostrado antes de recomputar, para que el próximo pick
  //      no repita salvo que el pool elegible se haya agotado (ver
  //      selectResurfaceEntries).
  reshuffleResurface(): void {
    const shown = this.resurfaceEntries().map((e) => e.id);
    this.resurfaceExcluded.update((curr) => new Set([...curr, ...shown]));
  }
}
