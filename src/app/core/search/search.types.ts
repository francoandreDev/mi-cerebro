// Entity-agnostic search model. Any entity adapter feeds documents in this
// shape; the index never looks at the original entity record.

export type EntityKind = string;

export interface SearchDoc {
  readonly id: string;
  readonly kind: EntityKind;
  readonly title: string;
  readonly body: string;
  readonly tagIds: readonly string[];
}

export interface SearchSnippet {
  readonly pre: string;
  readonly match: string;
  readonly post: string;
}

export interface SearchHit {
  readonly id: string;
  readonly kind: EntityKind;
  readonly title: string;
  readonly snippet: SearchSnippet;
  readonly score: number;
  readonly tagIds: readonly string[];
}

export interface SearchQuery {
  readonly text: string;
  readonly tagIds?: readonly string[];
  readonly kinds?: readonly EntityKind[];
  readonly limit?: number;
  // why: the command palette wants AND (the default) — every typed word
  //      should narrow results. A "find documents like this one" query
  //      (dashboard resurfacing's related mode) needs OR: querying with a
  //      whole paragraph under AND semantics requires the target to contain
  //      every single word, which returns nothing for real prose.
  readonly combineWith?: 'AND' | 'OR';
}

export const SEARCH_INDEX_VERSION = 2;
export const SEARCH_INDEX_KEY = 'mc-index';
