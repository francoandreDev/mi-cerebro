import type { GoalSummary } from '@features/goals/models/goal.types';
import type { NoteSummary } from '@features/notes/models/note.types';
import type { ReminderSummary } from '@features/reminders/models/reminder.types';
import type { TaskSummary } from '@features/tasks/models/task.types';
import type { WritingSummary } from '@features/writings/models/writing.types';

import type { DashboardRecentEntry } from './dashboard.types';

export const DASHBOARD_TASKS_LIMIT = 8;
export const DASHBOARD_GOALS_LIMIT = 6;
export const DASHBOARD_REMINDERS_LIMIT = 8;
export const DASHBOARD_RECENT_LIMIT = 8;

const PRIORITY_RANK: Record<GoalSummary['priority'], number> = { high: 0, med: 1, low: 2 };

const toIsoDate = (d: Date): string => d.toISOString().slice(0, 10);

export const selectTodayTasks = (
  tasks: readonly TaskSummary[],
  now: Date,
): readonly TaskSummary[] => {
  const today = toIsoDate(now);
  return tasks
    .filter((t) => !t.done && t.dueDates.some((d) => d.slice(0, 10) <= today))
    .sort((a, b) => earliestDue(a) - earliestDue(b) || a.title.localeCompare(b.title))
    .slice(0, DASHBOARD_TASKS_LIMIT);
};

const earliestDue = (t: TaskSummary): number => {
  const dates = t.dueDates.map((d) => Date.parse(d.slice(0, 10))).filter((n) => !Number.isNaN(n));
  return dates.length > 0 ? Math.min(...dates) : Number.POSITIVE_INFINITY;
};

export const selectActiveGoals = (
  goals: readonly GoalSummary[],
  now: Date,
): readonly GoalSummary[] => {
  const today = toIsoDate(now);
  return goals
    .filter((g) => !g.completed)
    .sort((a, b) => goalRank(a, today) - goalRank(b, today) || a.title.localeCompare(b.title))
    .slice(0, DASHBOARD_GOALS_LIMIT);
};

// why: vencidos primero, luego más próximos, sin fecha al final; prioridad
//      solo desempata dentro del mismo grupo de fecha.
const goalRank = (g: GoalSummary, today: string): number => {
  if (!g.deadline) return Number.POSITIVE_INFINITY;
  const deadline = g.deadline.slice(0, 10);
  const overdueBias = deadline < today ? -1e15 : 0;
  return overdueBias + Date.parse(deadline) + PRIORITY_RANK[g.priority] * 0.001;
};

export const selectUpcomingReminders = (
  reminders: readonly ReminderSummary[],
): readonly ReminderSummary[] =>
  reminders
    .filter((r) => !r.done && !r.paused)
    .sort((a, b) => a.nextPingAt.localeCompare(b.nextPingAt))
    .slice(0, DASHBOARD_REMINDERS_LIMIT);

export const mergeRecentEntries = (
  notes: readonly NoteSummary[],
  writings: readonly WritingSummary[],
): readonly DashboardRecentEntry[] => {
  const entries: DashboardRecentEntry[] = [
    ...notes.map(
      (n): DashboardRecentEntry => ({
        id: n.id,
        kind: 'note',
        title: n.title,
        preview: n.preview,
        updatedAt: n.updatedAt,
        tags: n.tags,
      }),
    ),
    ...writings.map(
      (w): DashboardRecentEntry => ({
        id: w.id,
        kind: 'writing',
        title: w.title,
        preview: w.preview,
        updatedAt: w.updatedAt,
        tags: w.tags,
      }),
    ),
  ];
  return entries
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, DASHBOARD_RECENT_LIMIT);
};
