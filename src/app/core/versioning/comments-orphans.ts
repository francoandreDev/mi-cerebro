// 13c-iv — position tracking for block-anchored comments.
//
// Block anchors live on the node `data-block-id` attribute (see 13c-i),
// which persists across edits as long as the block exists. The "tracking"
// reduces to a set-membership check at read/save time: any `block` anchor
// whose id is no longer in the doc is marked `orphaned: true`. The flag
// is rederived on every read, so persistence is not strictly required to
// keep the UI honest — but we re-apply before save so the rama comments
// reflects truth at write time and downstream consumers (search index,
// merge) see consistent state.
//
// 19.16e-iii — `range`-anchored comments (multi-block spans) extend the
// same membership check to both endpoints: `startBlockId` and
// `endBlockId` must both still be in the doc. A block *between* the two
// endpoints being deleted does not orphan the comment — the span just
// covers less content, same as trimming a single-block range.

import type { Comment } from './comments.types';

// Returns the same array reference when nothing changed (so signal
// effects that depend on it do not refire pointlessly).
export function applyOrphanFlags(
  comments: readonly Comment[],
  blockIdsInDoc: ReadonlySet<string>,
): readonly Comment[] {
  let changed = false;
  const next = comments.map((c) => {
    if (c.anchorType === 'entity') {
      if (c.orphaned) {
        // why: entity-anchored comments can never go orphan. If a stale
        //      `orphaned: true` ever sneaks in, normalize it.
        changed = true;
        return { ...c, orphaned: false };
      }
      return c;
    }
    const shouldBeOrphan =
      c.anchorType === 'block'
        ? !blockIdsInDoc.has(c.anchor)
        : !c.span ||
          !blockIdsInDoc.has(c.span.startBlockId) ||
          !blockIdsInDoc.has(c.span.endBlockId);
    if (c.orphaned === shouldBeOrphan) return c;
    changed = true;
    return { ...c, orphaned: shouldBeOrphan };
  });
  return changed ? next : comments;
}
