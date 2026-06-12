// 13c-iv — classify a commit message into the faceta of the branch it
// nominally targets. Used by the /history filter chips so the user can
// collapse the timeline by faceta. The detection is purely textual
// because git.log gives us messages, not refs; the prefixes follow the
// conventions documented in PROYECTO §12.

export type Facet = 'main' | 'comments' | 'draft';

export const ALL_FACETS: readonly Facet[] = ['main', 'comments', 'draft'];

const COMMENTS_RE = /^(?:auto|merge) \[comentarios\]:/;
const DRAFT_RE = /^(?:(?:auto|merge) \[borrador\]:|accept-draft:)/;

export function facetOf(message: string): Facet {
  if (COMMENTS_RE.test(message)) return 'comments';
  if (DRAFT_RE.test(message)) return 'draft';
  return 'main';
}
