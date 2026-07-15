import { describe, expect, it } from 'vitest';

import { isGoalDormant } from './goal.types';

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
