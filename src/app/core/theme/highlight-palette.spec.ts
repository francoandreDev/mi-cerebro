import { describe, expect, it } from 'vitest';

import { contrastHex } from './wcag';
import { HIGHLIGHT_SWATCHES, findHighlightSwatch, highlightHexFor } from './highlight-palette';

const FG_LIGHT = '#1f2328';
const FG_DARK = '#e6edf3';

describe('HIGHLIGHT_SWATCHES', () => {
  it('every light variant passes AA vs light body text', () => {
    for (const sw of HIGHLIGHT_SWATCHES) {
      const ratio = contrastHex(sw.light, FG_LIGHT);
      expect(ratio, `${sw.id} light vs body text = ${ratio}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('every dark variant passes AA vs dark body text', () => {
    for (const sw of HIGHLIGHT_SWATCHES) {
      const ratio = contrastHex(sw.dark, FG_DARK);
      expect(ratio, `${sw.id} dark vs body text = ${ratio}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('has unique ids', () => {
    const ids = new Set(HIGHLIGHT_SWATCHES.map((s) => s.id));
    expect(ids.size).toBe(HIGHLIGHT_SWATCHES.length);
  });
});

describe('findHighlightSwatch', () => {
  it('returns null for undefined or unknown id', () => {
    expect(findHighlightSwatch(undefined)).toBeNull();
    expect(findHighlightSwatch('not-a-color')).toBeNull();
  });

  it('finds a known swatch', () => {
    expect(findHighlightSwatch('yellow')?.id).toBe('yellow');
  });
});

describe('highlightHexFor', () => {
  it('resolves the hex for the requested theme', () => {
    expect(highlightHexFor('light', 'blue')).toBe('#85add6');
    expect(highlightHexFor('dark', 'blue')).toBe('#39526a');
  });

  it('returns null when the id is missing or unknown', () => {
    expect(highlightHexFor('light', undefined)).toBeNull();
    expect(highlightHexFor('light', 'nope')).toBeNull();
  });
});
