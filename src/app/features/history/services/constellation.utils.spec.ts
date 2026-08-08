import { describe, expect, it } from 'vitest';

import { buildConstellation } from './constellation.utils';
import type { DayAggregate } from './history-loader.service';

function day(
  dayStart: number,
  count: number,
  byFacet: Partial<DayAggregate['byFacet']> = {},
): DayAggregate {
  return {
    dayStart,
    count,
    byFacet: { main: count, comments: 0, draft: 0, ...byFacet },
  };
}

describe('buildConstellation', () => {
  it('returns nothing for an empty window', () => {
    expect(buildConstellation([])).toEqual([]);
  });

  it('places a single day at x=0 with max radius', () => {
    const stars = buildConstellation([day(1_000, 5)]);
    expect(stars).toHaveLength(1);
    expect(stars[0]!.x).toBe(0);
    expect(stars[0]!.radius).toBeCloseTo(6, 5);
  });

  it('spreads days linearly across the x axis by elapsed time, not index', () => {
    const DAY = 86_400_000;
    const stars = buildConstellation([day(0, 1), day(DAY, 1), day(4 * DAY, 1)]);
    const byDay = new Map(stars.map((s) => [s.dayStart, s]));
    expect(byDay.get(0)!.x).toBe(0);
    expect(byDay.get(DAY)!.x).toBeCloseTo(25, 5);
    expect(byDay.get(4 * DAY)!.x).toBe(100);
  });

  it('scales radius by sqrt of count relative to the busiest day, not linearly', () => {
    const stars = buildConstellation([day(0, 1), day(1, 4)]);
    const quiet = stars.find((s) => s.count === 1)!;
    const busy = stars.find((s) => s.count === 4)!;
    expect(busy.radius).toBeGreaterThan(quiet.radius);
    // sqrt(1/4) = 0.5, not 0.25 — the whole point of the sqrt scale.
    const quietFrac = (quiet.radius - 1.4) / (busy.radius - 1.4);
    expect(quietFrac).toBeCloseTo(0.5, 5);
  });

  it('picks the facet with the most commits that day as dominant', () => {
    const stars = buildConstellation([day(0, 5, { main: 1, comments: 4, draft: 0 })]);
    expect(stars[0]!.dominantFacet).toBe('comments');
  });

  it('is deterministic across calls for the same day', () => {
    const a = buildConstellation([day(123_456, 2)]);
    const b = buildConstellation([day(123_456, 2)]);
    expect(a[0]!.y).toBe(b[0]!.y);
  });
});
