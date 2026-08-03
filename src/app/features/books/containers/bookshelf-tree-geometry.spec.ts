import { describe, expect, it } from 'vitest';

import { buildTreeBranches } from './bookshelf-tree-geometry';
import type { CatalogShelf } from '../components/book-catalog-overlay.component';
import type { BookSummary } from '../models/book.types';

const book = (id: string): BookSummary => ({
  id,
  title: id,
  updatedAt: '2026-01-01T00:00:00.000Z',
  tags: [],
  folder: '',
  chapterCount: 1,
  position: 'a0',
  cover: { kind: 'auto' },
  back: { kind: 'auto' },
  accent: null,
  subtitle: '',
});

const shelf = (folder: string, books: readonly BookSummary[]): CatalogShelf => ({
  folder,
  label: folder || 'Sin estante',
  books,
  pinned: false,
});

describe('buildTreeBranches', () => {
  it('returns one branch per shelf, all points inside the 0-100 viewbox', () => {
    const shelves = [
      shelf('', [book('a'), book('b')]),
      shelf('fiction', [book('c')]),
      shelf('essays', [book('d'), book('e'), book('f')]),
    ];
    const branches = buildTreeBranches(shelves);
    expect(branches).toHaveLength(3);
    for (const branch of branches) {
      expect(branch.path).toMatch(/^M [\d.]+ [\d.]+ Q [\d.]+ [\d.]+ [\d.]+ [\d.]+$/);
      for (const point of branch.books) {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(100);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeLessThanOrEqual(100);
      }
    }
  });

  it('is deterministic across calls (no random placement)', () => {
    const shelves = [shelf('a', [book('x'), book('y'), book('z')])];
    const first = buildTreeBranches(shelves);
    const second = buildTreeBranches(shelves);
    expect(first[0]!.books.map((p) => [p.x, p.y])).toEqual(second[0]!.books.map((p) => [p.x, p.y]));
  });

  it('handles a single branch and a single book without dividing by zero', () => {
    const branches = buildTreeBranches([shelf('only', [book('solo')])]);
    expect(branches).toHaveLength(1);
    expect(branches[0]!.books).toHaveLength(1);
    expect(Number.isFinite(branches[0]!.books[0]!.x)).toBe(true);
    expect(Number.isFinite(branches[0]!.books[0]!.y)).toBe(true);
  });

  it('handles an empty shelf list', () => {
    expect(buildTreeBranches([])).toEqual([]);
  });
});
