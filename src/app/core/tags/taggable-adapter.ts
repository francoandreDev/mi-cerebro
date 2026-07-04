// Narrow view over an entity service that the tags admin screen needs:
// enumerate summaries with their tag ids, and rewrite an entity's tags
// in place. Each factory closes over its own concrete service/entity type
// so the exported interface stays generic-free.

export interface TaggableSummary {
  readonly id: string;
  readonly tags: readonly string[];
}

export interface TaggableAdapter {
  readonly kind: string;
  summaries(): readonly TaggableSummary[];
  replaceTags(id: string, nextTags: readonly string[]): Promise<void>;
}
