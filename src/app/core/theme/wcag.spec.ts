import { describe, expect, it } from 'vitest';

import { contrastHex, hslToHex, levelOf, parseHex, relativeLuminance } from './wcag';

describe('parseHex', () => {
  it('parses #rrggbb', () => {
    expect(parseHex('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
  });
  it('parses #rgb shorthand', () => {
    expect(parseHex('#fa0')).toEqual({ r: 255, g: 170, b: 0 });
  });
  it('rejects invalid input', () => {
    expect(parseHex('zzz')).toBeNull();
    expect(parseHex('#12345')).toBeNull();
  });
});

describe('contrastHex', () => {
  it('white vs black is 21', () => {
    expect(contrastHex('#ffffff', '#000000')).toBeCloseTo(21, 0);
  });
  it('same color is 1', () => {
    expect(contrastHex('#aabbcc', '#aabbcc')).toBeCloseTo(1, 1);
  });
  it('symmetric', () => {
    expect(contrastHex('#cfc8b8', '#1f2328')).toBeCloseTo(contrastHex('#1f2328', '#cfc8b8'), 5);
  });
});

describe('levelOf', () => {
  it('returns AAA when >= 7', () => {
    expect(levelOf(7)).toBe('AAA');
    expect(levelOf(10)).toBe('AAA');
  });
  it('returns AA when [4.5, 7)', () => {
    expect(levelOf(4.5)).toBe('AA');
    expect(levelOf(6.9)).toBe('AA');
  });
  it('returns fail below 4.5', () => {
    expect(levelOf(4.49)).toBe('fail');
    expect(levelOf(1)).toBe('fail');
  });
});

describe('hslToHex', () => {
  it('produces black for L=0', () => {
    expect(hslToHex(0, 0, 0)).toBe('#000000');
  });
  it('produces white for L=1', () => {
    expect(hslToHex(0, 0, 1)).toBe('#ffffff');
  });
  it('produces pure red for hue=0 sat=1 L=0.5', () => {
    expect(hslToHex(0, 1, 0.5)).toBe('#ff0000');
  });
});

describe('relativeLuminance', () => {
  it('black is 0', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
  });
  it('white is 1', () => {
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 4);
  });
});
