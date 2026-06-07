import { describe, expect, it } from 'vitest';

import type { Tag } from '@core/tags/tag.types';

import { parsePaletteQuery } from './palette-query';

const tags: readonly Tag[] = [
  { id: 'trabajo', label: 'Trabajo', color: '#000', createdAt: '' },
  { id: 'casa', label: 'Casa', color: '#000', createdAt: '' },
];

describe('parsePaletteQuery', () => {
  it('splits free text from tag tokens', () => {
    const r = parsePaletteQuery('reunion tag:trabajo notas', tags);
    expect(r.text).toBe('reunion notas');
    expect(r.tagIds).toEqual(['trabajo']);
    expect(r.unknownTags).toEqual([]);
  });

  it('accent-insensitive tag match', () => {
    const t: readonly Tag[] = [{ id: 'reunion', label: 'Reunión', color: '#0', createdAt: '' }];
    const r = parsePaletteQuery('tag:reunion', t);
    expect(r.tagIds).toEqual(['reunion']);
  });

  it('reports unknown tag tokens', () => {
    const r = parsePaletteQuery('tag:inexistente hola', tags);
    expect(r.unknownTags).toEqual(['inexistente']);
    expect(r.text).toBe('hola');
  });

  it('empty input → empty result', () => {
    const r = parsePaletteQuery('', tags);
    expect(r.text).toBe('');
    expect(r.tagIds).toEqual([]);
  });
});
