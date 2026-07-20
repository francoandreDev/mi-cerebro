import { bucketTasks, bucketToDueDate } from './task-buckets';
import type { TaskSummary } from '../models/task.types';

const NOW = new Date('2026-06-15T12:00:00Z');

const summary = (id: string, dueDates: readonly string[], done = false): TaskSummary => ({
  id,
  title: id,
  done,
  dueDates,
  reminder: { enabled: false },
  updatedAt: '2026-06-01T00:00:00Z',
  tags: [],
  folder: '',
  position: '',
});

describe('bucketTasks', () => {
  it('places overdue tasks in today with overdue flag', () => {
    const result = bucketTasks([summary('a', ['2026-06-10'])], NOW);
    expect(result.today).toHaveLength(1);
    expect(result.today[0]!.overdue).toBe(true);
    expect(result.week).toHaveLength(0);
    expect(result.backlog).toHaveLength(0);
  });

  it('places tasks due today in today without overdue flag', () => {
    const result = bucketTasks([summary('a', ['2026-06-15'])], NOW);
    expect(result.today).toHaveLength(1);
    expect(result.today[0]!.overdue).toBe(false);
  });

  it('places tasks within next 7 days in week', () => {
    const result = bucketTasks([summary('a', ['2026-06-16']), summary('b', ['2026-06-22'])], NOW);
    expect(result.week.map((b) => b.summary.id)).toEqual(['a', 'b']);
  });

  it('places tasks beyond 7 days in backlog', () => {
    const result = bucketTasks([summary('a', ['2026-06-23'])], NOW);
    expect(result.backlog).toHaveLength(1);
    expect(result.week).toHaveLength(0);
  });

  it('places tasks without dueDates in backlog', () => {
    const result = bucketTasks([summary('a', [])], NOW);
    expect(result.backlog).toHaveLength(1);
  });

  it('does not mark overdue when task is already done', () => {
    const result = bucketTasks([summary('a', ['2026-06-10'], true)], NOW);
    expect(result.today[0]!.overdue).toBe(false);
  });

  it('preserves input order within each bucket', () => {
    const result = bucketTasks(
      [
        summary('a', []),
        summary('b', ['2026-06-15']),
        summary('c', []),
        summary('d', ['2026-06-15']),
      ],
      NOW,
    );
    expect(result.today.map((b) => b.summary.id)).toEqual(['b', 'd']);
    expect(result.backlog.map((b) => b.summary.id)).toEqual(['a', 'c']);
  });
});

describe('bucketToDueDate', () => {
  it('today returns ISO date for now', () => {
    expect(bucketToDueDate('today', NOW)).toEqual(['2026-06-15']);
  });

  it('week returns ISO date 3 days from now', () => {
    expect(bucketToDueDate('week', NOW)).toEqual(['2026-06-18']);
  });

  it('backlog returns empty array', () => {
    expect(bucketToDueDate('backlog', NOW)).toEqual([]);
  });
});
