import { describe, expect, it } from 'vitest';

import { between, compare, initial, validate } from './fractional-position';

describe('fractional-position.between', () => {
  it('between(null, null) returns a non-empty key', () => {
    const k = between(null, null);
    expect(k.length).toBeGreaterThan(0);
    expect(k.endsWith('0')).toBe(false);
  });

  it('between(prev, null) is strictly greater than prev', () => {
    const a = initial();
    const k = between(a, null);
    expect(compare(a, k)).toBe(-1);
  });

  it('between(null, next) is strictly less than next', () => {
    const b = initial();
    const k = between(null, b);
    expect(compare(k, b)).toBe(-1);
  });

  it('two consecutive calls produce a strictly intermediate key', () => {
    const a = 'A';
    const b = 'C';
    const mid = between(a, b);
    expect(compare(a, mid)).toBe(-1);
    expect(compare(mid, b)).toBe(-1);
  });

  it('grows length when narrow range exhausts a single digit', () => {
    const a = 'U';
    const b = 'V';
    const mid = between(a, b);
    expect(mid.length).toBeGreaterThan(1);
    expect(compare(a, mid)).toBe(-1);
    expect(compare(mid, b)).toBe(-1);
  });

  it('never returns a key ending in the MIN char', () => {
    const samples: readonly (readonly [string | null, string | null])[] = [
      [null, null],
      [null, 'A'],
      ['A', null],
      ['A', 'B'],
      ['A', 'C'],
      ['U', 'V'],
      ['Az', 'B'],
    ];
    for (const [a, b] of samples) {
      const k = between(a, b);
      expect(k.endsWith('0')).toBe(false);
    }
  });

  it('throws when a >= b', () => {
    expect(() => between('B', 'A')).toThrow();
    expect(() => between('A', 'A')).toThrow();
  });

  it('rejects empty input', () => {
    expect(() => between('', null)).toThrow();
    expect(() => between(null, '')).toThrow();
  });

  it('rejects input ending in MIN char', () => {
    expect(() => between('A0', null)).toThrow();
  });

  it('rejects input with chars outside the alphabet', () => {
    expect(() => between('A-B', null)).toThrow();
  });

  it('repeated subdivision stays consistent and ordered', () => {
    // Insert 50 items at the front (each new item < all existing) and check
    // strict monotonic order is preserved.
    const keys: string[] = [between(null, null)];
    for (let i = 0; i < 50; i++) {
      const first = keys[0]!;
      keys.unshift(between(null, first));
    }
    for (let i = 0; i < keys.length - 1; i++) {
      expect(compare(keys[i]!, keys[i + 1]!)).toBe(-1);
    }
  });

  it('repeated subdivision in the middle stays ordered', () => {
    let lo = 'A';
    let hi = 'z';
    const inserted: string[] = [];
    for (let i = 0; i < 30; i++) {
      const m = between(lo, hi);
      inserted.push(m);
      if (i % 2 === 0) lo = m;
      else hi = m;
    }
    // every inserted key must satisfy A < k < z
    for (const k of inserted) {
      expect(compare('A', k)).toBe(-1);
      expect(compare(k, 'z')).toBe(-1);
    }
  });
});

describe('fractional-position.compare', () => {
  it('matches string lex order', () => {
    expect(compare('A', 'B')).toBe(-1);
    expect(compare('B', 'A')).toBe(1);
    expect(compare('A', 'A')).toBe(0);
    expect(compare('A', 'AA')).toBe(-1);
  });
});

describe('fractional-position.validate', () => {
  it('accepts valid keys', () => {
    expect(() => validate('A')).not.toThrow();
    expect(() => validate('Uz')).not.toThrow();
  });
  it('rejects invalid keys', () => {
    expect(() => validate('')).toThrow();
    expect(() => validate('A0')).toThrow();
    expect(() => validate('A!')).toThrow();
  });
});
