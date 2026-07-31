import { describe, expect, it } from 'vitest';

import { sortNamedFoldersPinnedFirst, toCatalogShelves } from './bookshelf-projections';

const shelf = (folder: string) => ({ folder, books: [] as never[] });

describe('sortNamedFoldersPinnedFirst', () => {
  it('keeps alphabetical order when nothing is pinned', () => {
    const out = sortNamedFoldersPinnedFirst(
      [shelf('Sci-fi'), shelf('Ensayos'), shelf('Poesía')],
      new Set(),
    );
    expect(out.map((s) => s.folder)).toEqual(['Ensayos', 'Poesía', 'Sci-fi']);
  });

  it('pushes pinned folders to the top, alphabetical among themselves', () => {
    const out = sortNamedFoldersPinnedFirst(
      [shelf('Sci-fi'), shelf('Ensayos'), shelf('Poesía'), shelf('Anotados')],
      new Set(['Poesía', 'Sci-fi']),
    );
    expect(out.map((s) => s.folder)).toEqual(['Poesía', 'Sci-fi', 'Anotados', 'Ensayos']);
  });

  it('does not mutate the input array', () => {
    const input = [shelf('B'), shelf('A')];
    sortNamedFoldersPinnedFirst(input, new Set(['B']));
    expect(input.map((s) => s.folder)).toEqual(['B', 'A']);
  });
});

describe('toCatalogShelves', () => {
  it('marks shelves as pinned per the given set', () => {
    const out = toCatalogShelves(
      [shelf('Ensayos'), shelf('Poesía')],
      (f) => f,
      new Set(['Poesía']),
    );
    expect(out).toEqual([
      { folder: 'Ensayos', label: 'Ensayos', books: [], pinned: false },
      { folder: 'Poesía', label: 'Poesía', books: [], pinned: true },
    ]);
  });
});
