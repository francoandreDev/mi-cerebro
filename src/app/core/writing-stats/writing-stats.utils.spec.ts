import { describe, expect, it } from 'vitest';

import { applyWritingDelta, getDayKey } from './writing-stats.utils';
import { emptyWritingStats } from './writing-stats.types';

describe('getDayKey', () => {
  it('formats as YYYY-MM-DD in the given timezone', () => {
    const date = new Date('2026-07-10T12:00:00Z');
    expect(getDayKey(date, 'America/Lima')).toBe('2026-07-10');
  });

  it('crosses the day boundary for a timezone far from UTC', () => {
    const date = new Date('2026-07-10T23:30:00Z');
    expect(getDayKey(date, 'Pacific/Auckland')).toBe('2026-07-11');
  });
});

describe('applyWritingDelta', () => {
  it('same day: just adds the delta, record tracks the running total', () => {
    const start = { ...emptyWritingStats(), dayKey: '2026-07-10' };
    const next = applyWritingDelta(start, 120, '2026-07-10');
    expect(next).toEqual({ ...start, actual: 120, record: 120 });
  });

  it('day change with prior activity: rolls actual into record/average, bumps activeDays', () => {
    const start = { ...emptyWritingStats(), dayKey: '2026-07-10', actual: 300, record: 300 };
    const next = applyWritingDelta(start, 50, '2026-07-11');
    expect(next).toEqual({
      schemaVersion: start.schemaVersion,
      dayKey: '2026-07-11',
      actual: 50,
      record: 300,
      average: 300,
      activeDays: 1,
    });
  });

  it('day change with no prior activity: does not count as an active day', () => {
    const start = { ...emptyWritingStats(), dayKey: '2026-07-10', actual: 0, activeDays: 3 };
    const next = applyWritingDelta(start, 10, '2026-07-11');
    expect(next.activeDays).toBe(3);
    expect(next.actual).toBe(10);
  });

  it('negative delta clamps actual at 0 instead of going negative', () => {
    const start = { ...emptyWritingStats(), dayKey: '2026-07-10', actual: 20 };
    const next = applyWritingDelta(start, -50, '2026-07-10');
    expect(next.actual).toBe(0);
  });

  it('skipping a day entirely (no save that day) does not inflate activeDays', () => {
    let stats = { ...emptyWritingStats(), dayKey: '2026-07-10', actual: 200, record: 200 };
    // day 11: no save at all happens, so the next save is on day 12
    stats = applyWritingDelta(stats, 100, '2026-07-12');
    expect(stats.activeDays).toBe(1);
    expect(stats.average).toBe(200);
    expect(stats.actual).toBe(100);
  });

  it('weighted average accumulates correctly across multiple active days', () => {
    let stats = { ...emptyWritingStats(), dayKey: '2026-07-10', actual: 100, record: 100 };
    stats = applyWritingDelta(stats, 300, '2026-07-11'); // day10 rolls: avg=100, activeDays=1
    stats = applyWritingDelta(stats, 200, '2026-07-12'); // day11 rolls: avg=(100+300)/2=200
    expect(stats.activeDays).toBe(2);
    expect(stats.average).toBe(200);
    expect(stats.record).toBe(300);
    expect(stats.actual).toBe(200);
  });
});
