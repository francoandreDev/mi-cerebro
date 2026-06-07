import { describe, expect, it } from 'vitest';

import { toSlug, withSuffix } from './slug';

describe('toSlug', () => {
  it('lowercases and dashes spaces', () => {
    expect(toSlug('Hola Mundo')).toBe('hola-mundo');
  });

  it('strips diacritics and decomposes compatibility chars', () => {
    expect(toSlug('Canción Nº 2')).toBe('cancion-no-2');
  });

  it('strips forbidden filesystem characters', () => {
    expect(toSlug('foo<bar>:"/\\|?*baz')).toBe('foo-bar-baz');
  });

  it('falls back to default on empty', () => {
    expect(toSlug('  ')).toBe('nota');
    expect(toSlug('***')).toBe('nota');
  });

  it('truncates to max length', () => {
    const long = 'a'.repeat(200);
    expect(toSlug(long).length).toBe(80);
  });

  it('uses custom fallback', () => {
    expect(toSlug('', 'tarea')).toBe('tarea');
  });
});

describe('withSuffix', () => {
  it('returns the base for n=1', () => {
    expect(withSuffix('foo', 1)).toBe('foo');
  });

  it('appends -N for n>1', () => {
    expect(withSuffix('foo', 2)).toBe('foo-2');
    expect(withSuffix('foo', 17)).toBe('foo-17');
  });
});
