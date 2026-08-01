import { describe, expect, it } from 'vitest';

import type { Tag } from '@core/tags/tag.types';

import { type KindOption, parsePaletteQuery } from './palette-query';

const tags: readonly Tag[] = [
  { id: 'trabajo', label: 'Trabajo', color: '#000', createdAt: '' },
  { id: 'casa', label: 'Casa', color: '#000', createdAt: '' },
];

const kindOptions: readonly KindOption[] = [
  { kind: 'task', label: 'Tareas' },
  { kind: 'note', label: 'Notas' },
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

  it('matches a kind token by its localized label', () => {
    const r = parsePaletteQuery('kind:tareas reunion', tags, kindOptions);
    expect(r.kinds).toEqual(['task']);
    expect(r.text).toBe('reunion');
  });

  it('matches a kind token by its raw literal', () => {
    const r = parsePaletteQuery('kind:task', tags, kindOptions);
    expect(r.kinds).toEqual(['task']);
  });

  it('is accent/case-insensitive for kind tokens', () => {
    const r = parsePaletteQuery('KIND:TAREAS', tags, kindOptions);
    expect(r.kinds).toEqual(['task']);
  });

  it('reports unknown kind tokens', () => {
    const r = parsePaletteQuery('kind:nosetal hola', tags, kindOptions);
    expect(r.unknownKinds).toEqual(['nosetal']);
    expect(r.text).toBe('hola');
  });

  it('combines tag and kind tokens with free text', () => {
    const r = parsePaletteQuery('tag:trabajo kind:tareas reunion', tags, kindOptions);
    expect(r.tagIds).toEqual(['trabajo']);
    expect(r.kinds).toEqual(['task']);
    expect(r.text).toBe('reunion');
  });

  it('defaults to no kinds when kindOptions is omitted', () => {
    const r = parsePaletteQuery('kind:tareas', tags);
    expect(r.kinds).toEqual([]);
    expect(r.unknownKinds).toEqual(['tareas']);
  });
});
