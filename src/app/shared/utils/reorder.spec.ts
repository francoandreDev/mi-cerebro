import { describe, expect, it } from 'vitest';

import { reorderById } from './reorder';

describe('reorderById', () => {
  it('moves item before target', () => {
    expect(reorderById(['a', 'b', 'c', 'd'], 'd', 'b')).toEqual(['a', 'd', 'b', 'c']);
  });

  it('moves item later in the list', () => {
    expect(reorderById(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual(['b', 'a', 'c', 'd']);
  });

  it('returns original when from === to', () => {
    const order = ['a', 'b'];
    expect(reorderById(order, 'a', 'a')).toBe(order);
  });

  it('appends from if target is missing', () => {
    expect(reorderById(['a', 'b'], 'a', 'z')).toEqual(['b', 'a']);
  });
});
