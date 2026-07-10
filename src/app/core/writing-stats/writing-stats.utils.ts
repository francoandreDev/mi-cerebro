import type { WritingStats } from './writing-stats.types';

// why: 'en-CA' formats as YYYY-MM-DD directly, avoiding manual padding.
//      Same Intl+timeZone approach as `isValidTimezone` in settings.service.ts.
export const getDayKey = (date: Date, timezone: string): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

// why: record/average only ever reflect a day that actually had writing —
//      an inactive day (actual === 0) rolls the dayKey forward without
//      touching activeDays or average, so silence never drags the average
//      down. `actual` clamps at 0 so heavy same-day deletions don't show a
//      negative "words written today".
export const applyWritingDelta = (
  stats: WritingStats,
  delta: number,
  todayKey: string,
): WritingStats => {
  let { dayKey, actual, record, average, activeDays } = stats;
  if (dayKey !== todayKey) {
    if (actual > 0) {
      record = Math.max(record, actual);
      average = (average * activeDays + actual) / (activeDays + 1);
      activeDays += 1;
    }
    dayKey = todayKey;
    actual = 0;
  }
  actual = Math.max(0, actual + delta);
  record = Math.max(record, actual);
  return { schemaVersion: stats.schemaVersion, dayKey, actual, record, average, activeDays };
};
