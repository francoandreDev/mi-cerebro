import { describe, expect, it } from 'vitest';

import { compare } from './fractional-position';
import { nextPositionAfter, seedMissingPositions } from './seed-positions';

describe('seedMissingPositions', () => {
  it('returns empty when every entry already has a position', () => {
    const out = seedMissingPositions([
      { id: 'a', position: 'A' },
      { id: 'b', position: 'B' },
    ]);
    expect(out).toEqual([]);
  });

  it('seeds all when no entry has a position', () => {
    const out = seedMissingPositions([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    expect(out.map((o) => o.id)).toEqual(['a', 'b', 'c']);
    expect(compare(out[0]!.position, out[1]!.position)).toBe(-1);
    expect(compare(out[1]!.position, out[2]!.position)).toBe(-1);
  });

  it('chains new positions after an existing anchor', () => {
    const out = seedMissingPositions([{ id: 'a', position: 'A' }, { id: 'b' }, { id: 'c' }]);
    expect(out.map((o) => o.id)).toEqual(['b', 'c']);
    expect(compare('A', out[0]!.position)).toBe(-1);
    expect(compare(out[0]!.position, out[1]!.position)).toBe(-1);
  });

  it('treats empty string as missing', () => {
    const out = seedMissingPositions([
      { id: 'a', position: '' },
      { id: 'b', position: '' },
    ]);
    expect(out).toHaveLength(2);
  });

  it('treats null as missing', () => {
    const out = seedMissingPositions([{ id: 'a', position: null }]);
    expect(out).toHaveLength(1);
  });
});

describe('nextPositionAfter', () => {
  it('returns a key greater than the previous', () => {
    const next = nextPositionAfter('A');
    expect(compare('A', next)).toBe(-1);
  });

  it('returns the initial key when last is null', () => {
    const next = nextPositionAfter(null);
    expect(next.length).toBeGreaterThan(0);
  });
});
