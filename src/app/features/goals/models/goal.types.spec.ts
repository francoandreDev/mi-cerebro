import { describe, expect, it } from 'vitest';

import {
  clampReminderLeadMinutes,
  goalDeadlineInstant,
  isGoalDormant,
  isValidTimeOfDay,
} from './goal.types';

const DAY_MS = 86_400_000;
const NOW = Date.parse('2026-07-15T12:00:00.000Z');

describe('isGoalDormant', () => {
  it('is false when lastProgressAt is within the threshold', () => {
    const recent = new Date(NOW - 5 * DAY_MS).toISOString();
    expect(isGoalDormant(false, recent, 14, NOW)).toBe(false);
  });

  it('is true when lastProgressAt is older than the threshold', () => {
    const old = new Date(NOW - 30 * DAY_MS).toISOString();
    expect(isGoalDormant(false, old, 14, NOW)).toBe(true);
  });

  it('is false right at the threshold boundary (strictly greater-than)', () => {
    const exact = new Date(NOW - 14 * DAY_MS).toISOString();
    expect(isGoalDormant(false, exact, 14, NOW)).toBe(false);
  });

  it('is always false for completed goals, regardless of age', () => {
    const veryOld = new Date(NOW - 400 * DAY_MS).toISOString();
    expect(isGoalDormant(true, veryOld, 14, NOW)).toBe(false);
  });

  it('is false for an unparseable lastProgressAt', () => {
    expect(isGoalDormant(false, 'not-a-date', 14, NOW)).toBe(false);
  });
});

describe('goalDeadlineInstant', () => {
  it('falls back to 23:59 when deadlineTime is absent (implicit end-of-day, unchanged behavior)', () => {
    const withDefault = goalDeadlineInstant('2026-07-10');
    const explicit = goalDeadlineInstant('2026-07-10', '23:59');
    expect(withDefault).toBe(explicit);
  });

  it('honors a custom deadlineTime', () => {
    const instant = goalDeadlineInstant('2026-07-10', '09:00');
    expect(new Date(instant!).getHours()).toBe(9);
    expect(new Date(instant!).getMinutes()).toBe(0);
  });

  it('ignores a malformed deadlineTime and falls back to 23:59', () => {
    const instant = goalDeadlineInstant('2026-07-10', 'garbage');
    expect(new Date(instant!).getHours()).toBe(23);
    expect(new Date(instant!).getMinutes()).toBe(59);
  });

  it('returns null for a malformed deadline', () => {
    expect(goalDeadlineInstant('not-a-date')).toBeNull();
  });
});

describe('isValidTimeOfDay', () => {
  it('accepts zero-padded HH:mm', () => {
    expect(isValidTimeOfDay('09:00')).toBe(true);
    expect(isValidTimeOfDay('23:59')).toBe(true);
    expect(isValidTimeOfDay('00:00')).toBe(true);
  });

  it('rejects malformed or out-of-range values', () => {
    expect(isValidTimeOfDay('24:00')).toBe(false);
    expect(isValidTimeOfDay('9:00')).toBe(false);
    expect(isValidTimeOfDay('09:60')).toBe(false);
    expect(isValidTimeOfDay(undefined)).toBe(false);
    expect(isValidTimeOfDay(42)).toBe(false);
  });
});

describe('clampReminderLeadMinutes', () => {
  it('clamps to the [2, 43200] range, same bounds as the global setting', () => {
    expect(clampReminderLeadMinutes(0)).toBe(2);
    expect(clampReminderLeadMinutes(100_000)).toBe(43_200);
    expect(clampReminderLeadMinutes(60.4)).toBe(60);
  });
});
