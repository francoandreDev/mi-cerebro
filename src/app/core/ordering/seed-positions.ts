import { between } from './fractional-position';

export interface PositionSeedInput {
  readonly id: string;
  readonly position?: string | null;
}

export interface PositionSeedResult {
  readonly id: string;
  readonly position: string;
}

// why: refresh() pass for §19.16b-iv. The caller passes entries already sorted
//      by the kind's legacy criterion (updatedAt desc, dueDate asc, etc.) and
//      gets back only the entries that need a new position written. Existing
//      positions are preserved verbatim and used as anchors for the chain so
//      partial pre-existing data stays consistent.
export const seedMissingPositions = (
  ordered: readonly PositionSeedInput[],
): readonly PositionSeedResult[] => {
  const out: PositionSeedResult[] = [];
  let prev: string | null = null;
  for (const item of ordered) {
    const existing = item.position ?? '';
    if (existing !== '') {
      prev = existing;
      continue;
    }
    const next = between(prev, null);
    out.push({ id: item.id, position: next });
    prev = next;
  }
  return out;
};

export const nextPositionAfter = (last: string | null): string => between(last, null);
