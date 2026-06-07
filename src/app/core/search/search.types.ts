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

export interface SearchHit {
  readonly id: string;
  readonly kind: EntityKind;
  readonly title: string;
  readonly snippet: string;
  readonly score: number;
  readonly tagIds: readonly string[];
}

export interface SearchQuery {
  readonly text: string;
  readonly tagIds?: readonly string[];
  readonly kinds?: readonly EntityKind[];
  readonly limit?: number;
}

export const SEARCH_INDEX_VERSION = 1;
export const SEARCH_INDEX_KEY = 'mc-index';
