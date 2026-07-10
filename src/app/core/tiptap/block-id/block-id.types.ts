// Foundation for 13c (anchored comments) + 13d (anchored drafts).
// Every block-level node that can be anchored carries a stable UUID
// persisted as `data-block-id`. The set is intentionally small: top-level
// block containers + list items (so a comment can attach to one bullet,
// not the whole list).

export const BLOCK_ID_ATTR = 'blockId';

export const BLOCK_ID_TARGET_TYPES: ReadonlySet<string> = new Set([
  'paragraph',
  'heading',
  'citation',
  'codeBlock',
  'listItem',
  'horizontalRule',
]);
