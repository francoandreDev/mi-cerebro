import type { TranslationKey } from '@core/i18n/i18n.types';

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

// why: formato relativo "hace N min/h/d/meses/años" para metadatos
//      de libros y capítulos. Vive en books/ porque sólo se usa acá;
//      si una segunda feature lo necesita se promueve a @shared.
export const formatAgo = (iso: string, t: Translate): string => {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diffMin = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (diffMin < 2) return t('books.editedAgo.justNow');
  if (diffMin < 60) return t('books.editedAgo.minutes', { n: diffMin });
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return t('books.editedAgo.hours', { n: diffH });
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return t('books.editedAgo.days', { n: diffD });
  const diffMo = Math.floor(diffD / 30);
  if (diffMo < 12) return t('books.editedAgo.months', { n: diffMo });
  return t('books.editedAgo.years', { n: Math.floor(diffMo / 12) });
};
