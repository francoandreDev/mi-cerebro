import type { GoalSummary } from '@features/goals/models/goal.types';
import type { ListSummary } from '@features/lists/models/list.types';
import type { NoteSummary } from '@features/notes/models/note.types';
import type { ReminderSummary } from '@features/reminders/models/reminder.types';
import type { TaskSummary } from '@features/tasks/models/task.types';
import type { WritingSummary } from '@features/writings/models/writing.types';

import type { DashboardRecentEntry } from './dashboard.types';

export const DASHBOARD_TASKS_LIMIT = 8;
export const DASHBOARD_GOALS_LIMIT = 6;
export const DASHBOARD_REMINDERS_LIMIT = 8;
export const DASHBOARD_RECENT_LIMIT = 8;
// why: §evolution.md idea 1 — "resurfacing pasivo". 14 días es el punto en
//      que algo deja de ser "reciente" (ya no aparece en mergeRecentEntries
//      con su tope de 8) sin todavía ser tan viejo que perdió contexto.
export const DASHBOARD_RESURFACE_STALE_DAYS = 14;
export const DASHBOARD_RESURFACE_LIMIT = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

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

const noteToEntry = (n: NoteSummary): DashboardRecentEntry => ({
  id: n.id,
  kind: 'note',
  title: n.title,
  preview: n.preview,
  updatedAt: n.updatedAt,
  tags: n.tags,
});

const writingToEntry = (w: WritingSummary): DashboardRecentEntry => ({
  id: w.id,
  kind: 'writing',
  title: w.title,
  preview: w.preview,
  updatedAt: w.updatedAt,
  tags: w.tags,
});

const listToEntry = (l: ListSummary): DashboardRecentEntry => ({
  id: l.id,
  kind: 'list',
  title: l.title,
  preview: l.previewItems.join(' · '),
  updatedAt: l.updatedAt,
  tags: l.tags,
});

export const mergeRecentEntries = (
  notes: readonly NoteSummary[],
  writings: readonly WritingSummary[],
): readonly DashboardRecentEntry[] => {
  const entries: DashboardRecentEntry[] = [
    ...notes.map(noteToEntry),
    ...writings.map(writingToEntry),
  ];
  return entries
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, DASHBOARD_RECENT_LIMIT);
};

// why: pool completo (sin tope ni orden) para que selectResurfaceEntries
//      decida qué mostrar — a diferencia de mergeRecentEntries, que ya
//      recorta y ordena por recencia porque ahí "reciente" es el criterio.
export const mergeResurfacePool = (
  notes: readonly NoteSummary[],
  writings: readonly WritingSummary[],
  lists: readonly ListSummary[],
): readonly DashboardRecentEntry[] => [
  ...notes.map(noteToEntry),
  ...writings.map(writingToEntry),
  ...lists.map(listToEntry),
];

// why: peso lineal por antigüedad (más viejo = más probable), sin reemplazo,
//      excluyendo lo ya mostrado en la sesión actual. Si la exclusión deja
//      el pool elegible vacío, se ignora (se "agotó" — mismo patrón que el
//      pool de objetivos de §13) para no trabar el widget en un dashboard
//      con pocas entidades stale.
export const selectResurfaceEntries = (
  pool: readonly DashboardRecentEntry[],
  excludedIds: ReadonlySet<string>,
  now: Date,
  random: () => number = Math.random,
): readonly DashboardRecentEntry[] => {
  const cutoff = now.getTime() - DASHBOARD_RESURFACE_STALE_DAYS * DAY_MS;
  const stale = pool.filter((e) => Date.parse(e.updatedAt) <= cutoff);
  const eligible = stale.filter((e) => !excludedIds.has(e.id));
  const source = eligible.length > 0 ? eligible : stale;
  return weightedSampleByAge(source, DASHBOARD_RESURFACE_LIMIT, now, random);
};

const weightedSampleByAge = (
  entries: readonly DashboardRecentEntry[],
  count: number,
  now: Date,
  random: () => number,
): readonly DashboardRecentEntry[] => {
  const remaining = entries.map((entry) => ({ entry, weight: ageDays(entry.updatedAt, now) }));
  const picked: DashboardRecentEntry[] = [];
  while (picked.length < count && remaining.length > 0) {
    const totalWeight = remaining.reduce((sum, r) => sum + r.weight, 0);
    let roll = random() * totalWeight;
    let index = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      roll -= remaining[i]!.weight;
      if (roll <= 0) {
        index = i;
        break;
      }
    }
    picked.push(remaining[index]!.entry);
    remaining.splice(index, 1);
  }
  return picked;
};

const ageDays = (updatedAt: string, now: Date): number =>
  Math.max(1, (now.getTime() - Date.parse(updatedAt)) / DAY_MS);
