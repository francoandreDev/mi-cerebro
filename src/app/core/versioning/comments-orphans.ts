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

import type { Comment } from './comments.types';

// Returns the same array reference when nothing changed (so signal
// effects that depend on it do not refire pointlessly).
export function applyOrphanFlags(
  comments: readonly Comment[],
  blockIdsInDoc: ReadonlySet<string>,
): readonly Comment[] {
  let changed = false;
  const next = comments.map((c) => {
    if (c.anchorType !== 'block') {
      if (c.orphaned) {
        // why: entity-anchored comments can never go orphan. If a stale
        //      `orphaned: true` ever sneaks in, normalize it.
        changed = true;
        return { ...c, orphaned: false };
      }
      return c;
    }
    const shouldBeOrphan = !blockIdsInDoc.has(c.anchor);
    if (c.orphaned === shouldBeOrphan) return c;
    changed = true;
    return { ...c, orphaned: shouldBeOrphan };
  });
  return changed ? next : comments;
}
