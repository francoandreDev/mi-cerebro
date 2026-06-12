import { describe, expect, it } from 'vitest';

import { facetOf } from './facet';

describe('facetOf', () => {
  it('classifies auto-comments commits', () => {
    expect(facetOf('auto [comentarios]: Mi nota (1 comentario)')).toBe('comments');
  });

  it('classifies merge-comments commits', () => {
    expect(facetOf('merge [comentarios]: abc123 (from "X" into "Y")')).toBe('comments');
  });

  it('classifies auto-draft commits', () => {
    expect(facetOf('auto [borrador]: Mi nota (3 cambios)')).toBe('draft');
  });

  it('classifies accept-draft commits', () => {
    expect(facetOf('accept-draft: Mi nota (2 cambios)')).toBe('draft');
  });

  it('falls back to main for autocommit and merge', () => {
    expect(facetOf('auto: 3 notes (2026-06-12) [timer]')).toBe('main');
    expect(facetOf('merge: notes/x.json (from "X" into "Y")')).toBe('main');
    expect(facetOf('restore: snapshot completo desde abc1234')).toBe('main');
  });

  it('does not mis-classify a body line that mentions comentarios later', () => {
    const msg = 'auto: 3 notes\n\nComment: este commit cubre comentarios viejos';
    expect(facetOf(msg)).toBe('main');
  });
});
