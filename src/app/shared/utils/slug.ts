const FORBIDDEN = /[<>:"/\\|?*\s-]/g;
const NON_SLUG = /[^a-z0-9]+/g;
const TRIM_DASHES = /^-+|-+$/g;

const MAX_LEN = 80;

// why: produces a filesystem-safe slug (rule 4.x: trim non-portable chars,
//      show clean UI title but derived slug on disk).
export const toSlug = (input: string, fallback = 'nota'): string => {
  const normalized = input
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(FORBIDDEN, ' ')
    .toLowerCase()
    .replace(NON_SLUG, '-')
    .replace(TRIM_DASHES, '')
    .slice(0, MAX_LEN);
  return normalized.length > 0 ? normalized : fallback;
};

// why: keeps disambiguation suffix off the canonical slug so callers can
//      compare base equality and the on-disk variant lives only in name.
export const withSuffix = (slug: string, n: number): string => (n <= 1 ? slug : `${slug}-${n}`);
