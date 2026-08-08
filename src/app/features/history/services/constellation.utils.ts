// Pure layout math for the /history "constellation" secondary view — a
// starfield read of work rhythm (day-aggregated commit volume) instead of
// a navigable commit list. Position on the x axis is real time (so gaps
// read as literal dark stretches of sky); y is a deterministic jitter
// derived from the day's own timestamp, purely to avoid a flat row of
// dots — it carries no data. Star size/brightness is the one channel that
// does: it scales with that day's commit count.

import type { DayAggregate } from './history-loader.service';
import type { Facet } from './facet';

export interface ConstellationStar {
  readonly dayStart: number;
  readonly count: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly dominantFacet: Facet;
}

const RADIUS_MIN = 1.4;
// why: sqrt scale, not linear — one 40-commit autocommit-spam day
// shouldn't dwarf every other star into invisibility.
const RADIUS_MAX = 6;

// why: same hash-to-[0,1) trick as goal-wall-layout.utils.ts stepOffset —
// deterministic per input, no seeded RNG dependency.
function hashUnit(seed: number): number {
  let h = seed | 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h ^= h >>> 16;
  return (h >>> 0) / 0xffffffff;
}

function dominantFacetOf(byFacet: Readonly<Record<Facet, number>>): Facet {
  return (Object.keys(byFacet) as Facet[]).reduce((best, f) =>
    byFacet[f] > byFacet[best] ? f : best,
  );
}

export function buildConstellation(
  aggregates: readonly DayAggregate[],
): readonly ConstellationStar[] {
  if (aggregates.length === 0) return [];
  const days = aggregates.map((a) => a.dayStart);
  const minDay = Math.min(...days);
  const maxDay = Math.max(...days);
  const span = Math.max(1, maxDay - minDay);
  const maxCount = Math.max(...aggregates.map((a) => a.count));
  return aggregates.map((a) => {
    const x = ((a.dayStart - minDay) / span) * 100;
    const y = 12 + hashUnit(Math.floor(a.dayStart / 86_400_000)) * 76;
    const norm = maxCount > 0 ? a.count / maxCount : 0;
    const radius = RADIUS_MIN + Math.sqrt(norm) * (RADIUS_MAX - RADIUS_MIN);
    return {
      dayStart: a.dayStart,
      count: a.count,
      x,
      y,
      radius,
      dominantFacet: dominantFacetOf(a.byFacet),
    };
  });
}
