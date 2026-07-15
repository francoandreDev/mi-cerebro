import { describe, expect, it } from 'vitest';

import type { GoalSummary } from '@features/goals/models/goal.types';
import type { ListSummary } from '@features/lists/models/list.types';
import type { NoteSummary } from '@features/notes/models/note.types';
import type { ReminderSummary } from '@features/reminders/models/reminder.types';
import type { TaskSummary } from '@features/tasks/models/task.types';
import type { WritingSummary } from '@features/writings/models/writing.types';

import {
  mergeRecentEntries,
  mergeResurfacePool,
  selectActiveGoals,
  selectResurfaceEntries,
  selectTodayTasks,
  selectUpcomingReminders,
} from './dashboard-filters';

const NOW = new Date('2026-07-14T12:00:00.000Z');

const task = (overrides: Partial<TaskSummary>): TaskSummary => ({
  id: 't1',
  title: 'Task',
  done: false,
  dueDates: [],
  updatedAt: '2026-07-01T00:00:00.000Z',
  tags: [],
  folder: '',
  position: '0',
  ...overrides,
});

const goal = (overrides: Partial<GoalSummary>): GoalSummary => ({
  id: 'g1',
  title: 'Goal',
  deadline: null,
  completed: false,
  priority: 'med',
  progress: 0,
  reminder: { enabled: false },
  lastProgressAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  tags: [],
  folder: '',
  position: '0',
  steps: [],
  stepsTotal: 0,
  stepsDone: 0,
  ...overrides,
});

const reminder = (overrides: Partial<ReminderSummary>): ReminderSummary => ({
  id: 'r1',
  title: 'Reminder',
  dueAt: '2026-07-14T09:00:00.000Z',
  nextPingAt: '2026-07-14T09:00:00.000Z',
  done: false,
  paused: false,
  recurrence: null,
  sourceKind: null,
  sourceId: null,
  updatedAt: '2026-07-01T00:00:00.000Z',
  ...overrides,
});

const note = (overrides: Partial<NoteSummary>): NoteSummary => ({
  id: 'n1',
  title: 'Note',
  updatedAt: '2026-07-01T00:00:00.000Z',
  tags: [],
  folder: '',
  position: '0',
  preview: '',
  scheduledFor: null,
  ...overrides,
});

const writing = (overrides: Partial<WritingSummary>): WritingSummary => ({
  id: 'w1',
  title: 'Writing',
  updatedAt: '2026-07-01T00:00:00.000Z',
  tags: [],
  folder: '',
  position: '0',
  preview: '',
  wordCount: 0,
  ...overrides,
});

const list = (overrides: Partial<ListSummary>): ListSummary => ({
  id: 'l1',
  title: 'List',
  updatedAt: '2026-07-01T00:00:00.000Z',
  tags: [],
  folder: '',
  position: '0',
  previewItems: [],
  itemCount: 0,
  ...overrides,
});

describe('selectTodayTasks', () => {
  it('includes due-today and overdue, excludes done and future', () => {
    const today = task({ id: 'today', dueDates: ['2026-07-14'] });
    const overdue = task({ id: 'overdue', dueDates: ['2026-07-10'] });
    const doneToday = task({ id: 'done', dueDates: ['2026-07-14'], done: true });
    const tomorrow = task({ id: 'tomorrow', dueDates: ['2026-07-15'] });
    const result = selectTodayTasks([today, overdue, doneToday, tomorrow], NOW);
    expect(result.map((t) => t.id)).toEqual(['overdue', 'today']);
  });

  it('sorts by earliest due date', () => {
    const a = task({ id: 'a', title: 'A', dueDates: ['2026-07-12'] });
    const b = task({ id: 'b', title: 'B', dueDates: ['2026-07-10'] });
    const result = selectTodayTasks([a, b], NOW);
    expect(result.map((t) => t.id)).toEqual(['b', 'a']);
  });
});

describe('selectActiveGoals', () => {
  it('excludes completed goals', () => {
    const active = goal({ id: 'active', completed: false });
    const done = goal({ id: 'done', completed: true });
    const result = selectActiveGoals([active, done], NOW);
    expect(result.map((g) => g.id)).toEqual(['active']);
  });

  it('sorts overdue before future deadlines, nulls last', () => {
    const overdue = goal({ id: 'overdue', deadline: '2026-07-01' });
    const soon = goal({ id: 'soon', deadline: '2026-07-20' });
    const noDeadline = goal({ id: 'none', deadline: null });
    const result = selectActiveGoals([soon, noDeadline, overdue], NOW);
    expect(result.map((g) => g.id)).toEqual(['overdue', 'soon', 'none']);
  });

  it('uses priority as a tiebreak for equal deadlines', () => {
    const low = goal({ id: 'low', deadline: '2026-07-20', priority: 'low' });
    const high = goal({ id: 'high', deadline: '2026-07-20', priority: 'high' });
    const result = selectActiveGoals([low, high], NOW);
    expect(result.map((g) => g.id)).toEqual(['high', 'low']);
  });
});

describe('selectUpcomingReminders', () => {
  it('excludes done and paused reminders, sorts by nextPingAt', () => {
    const soon = reminder({ id: 'soon', nextPingAt: '2026-07-14T08:00:00.000Z' });
    const later = reminder({ id: 'later', nextPingAt: '2026-07-15T08:00:00.000Z' });
    const isDone = reminder({ id: 'done', done: true });
    const paused = reminder({ id: 'paused', paused: true });
    const result = selectUpcomingReminders([later, isDone, paused, soon]);
    expect(result.map((r) => r.id)).toEqual(['soon', 'later']);
  });
});

describe('mergeRecentEntries', () => {
  it('merges notes and writings sorted by updatedAt desc, tagged by kind', () => {
    const n = note({ id: 'n1', updatedAt: '2026-07-10T00:00:00.000Z' });
    const w = writing({ id: 'w1', updatedAt: '2026-07-12T00:00:00.000Z' });
    const result = mergeRecentEntries([n], [w]);
    expect(result).toEqual([
      expect.objectContaining({ id: 'w1', kind: 'writing' }),
      expect.objectContaining({ id: 'n1', kind: 'note' }),
    ]);
  });

  it('caps the result at the recent limit', () => {
    const notes = Array.from({ length: 12 }, (_, i) =>
      note({ id: `n${i}`, updatedAt: `2026-07-${String(i + 1).padStart(2, '0')}T00:00:00.000Z` }),
    );
    const result = mergeRecentEntries(notes, []);
    expect(result).toHaveLength(8);
  });
});

describe('mergeResurfacePool', () => {
  it('merges notes, writings and lists uncapped and unsorted, tagged by kind', () => {
    const n = note({ id: 'n1' });
    const w = writing({ id: 'w1' });
    const l = list({ id: 'l1', previewItems: ['comprar leche', 'llamar a mamá'] });
    const result = mergeResurfacePool([n], [w], [l]);
    expect(result).toEqual([
      expect.objectContaining({ id: 'n1', kind: 'note' }),
      expect.objectContaining({ id: 'w1', kind: 'writing' }),
      expect.objectContaining({ id: 'l1', kind: 'list', preview: 'comprar leche · llamar a mamá' }),
    ]);
  });
});

describe('selectResurfaceEntries', () => {
  const NOW_MS = NOW.getTime();
  const daysAgoIso = (days: number): string => new Date(NOW_MS - days * 86400000).toISOString();

  it('excludes entries updated within the stale threshold', () => {
    const fresh = note({ id: 'fresh', updatedAt: daysAgoIso(2) });
    const stale = note({ id: 'stale', updatedAt: daysAgoIso(30) });
    const pool = mergeResurfacePool([fresh, stale], [], []);
    const result = selectResurfaceEntries(pool, new Set(), NOW);
    expect(result.map((e) => e.id)).toEqual(['stale']);
  });

  it('never repeats an id within a single pick', () => {
    const pool = mergeResurfacePool(
      Array.from({ length: 5 }, (_, i) => note({ id: `n${i}`, updatedAt: daysAgoIso(20 + i) })),
      [],
      [],
    );
    const result = selectResurfaceEntries(pool, new Set(), NOW, () => 0.999);
    expect(new Set(result.map((e) => e.id)).size).toBe(result.length);
  });

  it('falls back to the full stale pool once exclusions exhaust it', () => {
    const a = note({ id: 'a', updatedAt: daysAgoIso(20) });
    const b = note({ id: 'b', updatedAt: daysAgoIso(21) });
    const pool = mergeResurfacePool([a, b], [], []);
    const result = selectResurfaceEntries(pool, new Set(['a', 'b']), NOW, () => 0);
    expect(result.map((e) => e.id).sort()).toEqual(['a', 'b']);
  });

  it('weights the pick towards older entries', () => {
    const veryOld = note({ id: 'old', updatedAt: daysAgoIso(200) });
    const barelyStale = note({ id: 'young', updatedAt: daysAgoIso(15) });
    const pool = mergeResurfacePool([veryOld, barelyStale], [], []);
    // why: random() picks the second candidate only if its cumulative
    //      weight share is reached — with `old` so much heavier, a roll
    //      just past its own weight share still lands on it, not `young`.
    const result = selectResurfaceEntries(pool, new Set(), NOW, () => 0.5);
    expect(result[0]?.id).toBe('old');
  });
});
