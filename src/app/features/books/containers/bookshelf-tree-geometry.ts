import type { CatalogShelf } from '../components/book-catalog-overlay.component';
import type { BookSummary } from '../models/book.types';

export interface TreeBookPoint {
  readonly book: BookSummary;
  readonly x: number;
  readonly y: number;
}

export interface TreeBranch {
  readonly folder: string;
  readonly label: string;
  readonly pinned: boolean;
  readonly path: string;
  readonly books: readonly TreeBookPoint[];
}

const TRUNK_X = 50;
const TRUNK_TOP_Y = 10;
const TRUNK_BOTTOM_Y = 94;
const MIN_BRANCH_LEN = 16;
const MAX_BRANCH_LEN = 40;
const JITTER_RADIUS = 3;

const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

const quadBezierPoint = (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  t: number,
): { x: number; y: number } => {
  const mt = 1 - t;
  return {
    x: mt * mt * x0 + 2 * mt * t * x1 + t * t * x2,
    y: mt * mt * y0 + 2 * mt * t * y1 + t * t * y2,
  };
};

// why: deterministic per-book jitter so books don't line up in a perfect
//      row along the branch — same technique as goal-constellation-editor's
//      stepOffset, no persisted coordinates needed (see plan doc / regla YAGNI).
const jitterFor = (id: string): { dx: number; dy: number } => {
  const h = hash(id);
  const dx = (((h & 0xff) / 255) * 2 - 1) * JITTER_RADIUS;
  const dy = ((((h >> 8) & 0xff) / 255) * 2 - 1) * JITTER_RADIUS;
  return { dx, dy };
};

// why: builds one Bézier branch per folder, alternating sides as it climbs
//      the trunk, with books distributed evenly along the curve. Pure
//      function of the catalog data already computed by the container — no
//      new persisted state (§4.8.19 YAGNI, see docs/deferred/trash-books.md
//      for why a full shape editor is out of scope for v1).
export const buildTreeBranches = (shelves: readonly CatalogShelf[]): readonly TreeBranch[] => {
  const n = shelves.length;
  return shelves.map((shelf, i) => {
    const t = n <= 1 ? 0.5 : i / (n - 1);
    const originY = TRUNK_BOTTOM_Y - t * (TRUNK_BOTTOM_Y - TRUNK_TOP_Y);
    const side = i % 2 === 0 ? 1 : -1;
    const bookCount = shelf.books.length;
    const length = clamp(
      MIN_BRANCH_LEN + Math.sqrt(Math.max(bookCount, 1)) * 8,
      MIN_BRANCH_LEN,
      MAX_BRANCH_LEN,
    );
    const endX = clamp(TRUNK_X + side * length, 4, 96);
    const endY = clamp(originY - length * 0.35, 4, 96);
    const ctrlX = clamp(TRUNK_X + side * length * 0.55, 4, 96);
    const ctrlY = clamp(originY - length * 0.15, 4, 96);
    const path = `M ${TRUNK_X} ${originY} Q ${ctrlX} ${ctrlY} ${endX} ${endY}`;
    const books = shelf.books.map((book, idx) => {
      const bt = bookCount <= 1 ? 0.8 : 0.2 + (idx / (bookCount - 1)) * 0.7;
      const point = quadBezierPoint(TRUNK_X, originY, ctrlX, ctrlY, endX, endY, bt);
      const jitter = jitterFor(book.id);
      return {
        book,
        x: clamp(point.x + jitter.dx, 2, 98),
        y: clamp(point.y + jitter.dy, 2, 98),
      };
    });
    return { folder: shelf.folder, label: shelf.label, pinned: shelf.pinned, path, books };
  });
};

export const TRUNK_PATH = `M ${TRUNK_X} ${TRUNK_BOTTOM_Y} L ${TRUNK_X} ${TRUNK_TOP_Y}`;
