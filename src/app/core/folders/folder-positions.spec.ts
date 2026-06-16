import { describe, expect, it } from 'vitest';

import { compare } from '@core/ordering/fractional-position';

import {
  deleteFolderPositions,
  nextFolderPositionFor,
  renameFolderPositions,
  seedFolderPositions,
} from './folder-positions';

describe('seedFolderPositions', () => {
  it('seeds an empty positions map', () => {
    const out = seedFolderPositions({}, ['a', 'b', 'c']);
    expect(Object.keys(out).sort()).toEqual(['a', 'b', 'c']);
    expect(compare(out['a']!, out['b']!)).toBe(-1);
    expect(compare(out['b']!, out['c']!)).toBe(-1);
  });

  it('keeps existing positions and only fills missing ones', () => {
    const out = seedFolderPositions({ a: 'M' }, ['a', 'b']);
    expect(out['a']).toBe('M');
    expect(out['b']).toBeDefined();
    expect(compare('M', out['b']!)).toBe(-1);
  });

  it('seeds siblings independently per parent', () => {
    const out = seedFolderPositions({}, ['root1', 'root1/leaf', 'root2', 'root2/leaf']);
    // siblings under root1 and root2 use independent chains
    expect(out['root1']).toBeDefined();
    expect(out['root2']).toBeDefined();
    expect(out['root1/leaf']).toBeDefined();
    expect(out['root2/leaf']).toBeDefined();
  });

  it('returns the same reference when nothing was seeded', () => {
    const initial = { a: 'A', b: 'B' };
    const out = seedFolderPositions(initial, ['a', 'b']);
    expect(out).toBe(initial);
  });
});

describe('nextFolderPositionFor', () => {
  it('returns a position greater than the last sibling under the parent', () => {
    const next = nextFolderPositionFor({ a: 'A', b: 'B', 'a/sub': 'X' }, '');
    expect(compare('B', next)).toBe(-1);
  });

  it('ignores siblings under other parents', () => {
    const next = nextFolderPositionFor({ a: 'A', 'b/sub': 'Z' }, 'b');
    expect(compare('Z', next)).toBe(-1);
  });
});

describe('renameFolderPositions', () => {
  it('rewrites the renamed path and all descendants', () => {
    const out = renameFolderPositions({ a: 'A', 'a/leaf': 'B', other: 'X' }, 'a', 'z');
    expect(out['z']).toBe('A');
    expect(out['z/leaf']).toBe('B');
    expect(out['other']).toBe('X');
    expect(out['a']).toBeUndefined();
  });
});

describe('deleteFolderPositions', () => {
  it('removes a path and its descendants', () => {
    const out = deleteFolderPositions({ a: 'A', 'a/leaf': 'B', other: 'X' }, 'a');
    expect(out).toEqual({ other: 'X' });
  });
});
