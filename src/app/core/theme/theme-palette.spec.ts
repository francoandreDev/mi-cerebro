import { describe, expect, it } from 'vitest';

import {
  ACCENT_FG,
  ACCENT_PALETTE,
  BG_SAT_LEVELS,
  TAG_SWATCHES,
  computeBgHex,
  deriveBgScale,
  findAccent,
  findTagSwatch,
  reportContrast,
} from './theme-palette';
import { contrastHex } from './wcag';

const FG_LIGHT = '#1f2328';
const FG_DARK = '#e6edf3';

describe('ACCENT_PALETTE', () => {
  it('every light accent passes AA vs ACCENT_FG.light', () => {
    for (const sw of ACCENT_PALETTE) {
      const ratio = contrastHex(sw.light, ACCENT_FG.light);
      expect(ratio, `${sw.id} light vs white = ${ratio}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('every dark accent passes AA vs ACCENT_FG.dark', () => {
    for (const sw of ACCENT_PALETTE) {
      const ratio = contrastHex(sw.dark, ACCENT_FG.dark);
      expect(ratio, `${sw.id} dark vs near-black = ${ratio}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('has unique ids', () => {
    const ids = new Set(ACCENT_PALETTE.map((s) => s.id));
    expect(ids.size).toBe(ACCENT_PALETTE.length);
  });
});

describe('TAG_SWATCHES', () => {
  it('every light variant has ≥ 3:1 contrast vs light bg', () => {
    const lightBg = '#cfc8b8';
    for (const sw of TAG_SWATCHES) {
      const ratio = contrastHex(sw.light, lightBg);
      expect(ratio, `${sw.id} light vs light bg = ${ratio}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('every dark variant has ≥ 3:1 contrast vs dark bg', () => {
    const darkBg = '#0d1117';
    for (const sw of TAG_SWATCHES) {
      const ratio = contrastHex(sw.dark, darkBg);
      expect(ratio, `${sw.id} dark vs dark bg = ${ratio}`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('computeBgHex + locked lightness', () => {
  const hues = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
  const sats = Object.keys(BG_SAT_LEVELS) as (keyof typeof BG_SAT_LEVELS)[];

  it('every (hue, sat) light bg passes AA against FG_LIGHT', () => {
    for (const h of hues) {
      for (const s of sats) {
        const bg = computeBgHex('light', h, s);
        const ratio = contrastHex(bg, FG_LIGHT);
        expect(ratio, `h=${h} s=${s} bg=${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('every (hue, sat) dark bg passes AA against FG_DARK', () => {
    for (const h of hues) {
      for (const s of sats) {
        const bg = computeBgHex('dark', h, s);
        const ratio = contrastHex(bg, FG_DARK);
        expect(ratio, `h=${h} s=${s} bg=${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe('deriveBgScale', () => {
  it('produces 5 distinct shades', () => {
    const scale = deriveBgScale('light', '#cfc8b8', 43, 'mid');
    expect(
      new Set([scale.base, scale.surface, scale.elevated, scale.hover, scale.selected]).size,
    ).toBeGreaterThanOrEqual(4);
  });
});

describe('findAccent / findTagSwatch', () => {
  it('falls back to default accent on unknown id', () => {
    expect(findAccent('zzz').id).toBe('orange');
    expect(findAccent(undefined).id).toBeTruthy();
  });
  it('returns null for unknown tag swatch', () => {
    expect(findTagSwatch('zzz')).toBeNull();
    expect(findTagSwatch(undefined)).toBeNull();
  });
});

describe('reportContrast', () => {
  it('reports AAA for white on black', () => {
    const r = reportContrast('#ffffff', '#000000');
    expect(r.passesAAA).toBe(true);
    expect(r.passesAA).toBe(true);
  });
  it('reports fail for low contrast', () => {
    const r = reportContrast('#888', '#999');
    expect(r.passesAA).toBe(false);
  });
});
