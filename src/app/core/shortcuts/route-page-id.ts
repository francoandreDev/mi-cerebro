// why: the same "which page am I on" slug is needed by the per-page
//      shortcuts filter and by the tutorial control — a single pure
//      function keeps both in sync instead of two ad-hoc url.split calls.
export const routePageId = (url: string): string | null => {
  const [, first] = url.split('?')[0]?.split('/') ?? [];
  return first && first.length > 0 ? first : null;
};
