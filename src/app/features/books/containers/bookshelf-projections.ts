import type { TranslationKey } from '@core/i18n/i18n.types';

import type { CatalogShelf } from '../components/book-catalog-overlay.component';
import type { BookSummary } from '../models/book.types';
import { formatAgo } from './format-ago';

interface ShelfLike {
  readonly folder: string;
  readonly books: readonly { readonly summary: BookSummary }[];
}

type Translator = (key: TranslationKey, params?: Record<string, string | number>) => string;

// why: aplana shelves agrupados para alimentar el overlay del catálogo —
//      sólo necesita la BookSummary, no la SummaryView con tooltip.
export const toCatalogShelves = <S extends ShelfLike>(
  shelves: readonly S[],
  resolveLabel: (folder: string) => string,
): readonly CatalogShelf[] =>
  shelves.map((s) => ({
    folder: s.folder,
    label: resolveLabel(s.folder),
    books: s.books.map((v) => v.summary),
  }));

// why: tooltip del slot del bookshelf — formato `{title} · {chapters} · ...`.
export const buildBookTooltip = (s: BookSummary, t: Translator): string => {
  const chapters =
    s.chapterCount === 1
      ? t('books.chapters.countOne')
      : t('books.chapters.countMany', { count: s.chapterCount });
  const ago = formatAgo(s.updatedAt, (k, p) => t(k, p));
  return t('books.shelf.tooltip', {
    title: s.title || t('books.untitledTitle'),
    chapters,
    words: '—',
    ago,
  });
};
