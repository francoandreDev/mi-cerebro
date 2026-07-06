// 19.16e-ii — Keeps persisted `Comment.range` offsets in sync with edits.
// comment-clouds.ext's decorations already re-map their *visual* position
// on every transaction via `prev.map(tr.mapping, tr.doc)`, but that mapped
// position lives only in the current ProseMirror session: the moment the
// host pushes a fresh comment list through COMMENT_CLOUDS_META_KEY (e.g.
// another comment gets added/edited elsewhere), buildDecorations rebuilds
// from the *stored* range again, snapping the cloud/underline back to its
// creation-time offsets. This plugin tracks each block-anchored range's
// absolute position across transactions, converts it back to a
// block-relative offset after every doc change, and reports the corrected
// values to the host so it can update (and eventually persist) the source
// of truth instead of just the throwaway decoration state.
//
// 19.16e-iii — extends the same tracking to `range`-anchored `span`s
// (selections crossing two or more blocks). A span tracks the same pair of
// absolute positions as a single-block range — `tr.mapping` doesn't care
// which block a position falls in — the only difference is in
// `collectSpanUpdates`, which resolves each endpoint back to *whichever*
// block currently contains it (rather than a single fixed block), since
// edits upstream can shift which block owns the start/end offset.

import { Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';

import { BLOCK_ID_ATTR } from '../block-id/block-id.types';

import type { Comment, CommentRange, CommentSpan } from '@core/versioning/comments.types';

export const COMMENT_RANGE_MAPPING_EXTENSION_NAME = 'mcCommentRangeMapping';
export const COMMENT_RANGE_MAPPING_META_KEY = 'mc-comment-range-mapping.set';

export type CommentRangeUpdate =
  | { readonly id: string; readonly range: CommentRange }
  | { readonly id: string; readonly span: CommentSpan }
  | { readonly id: string; readonly orphaned: true };

export interface CommentRangeMappingHandlers {
  readonly getComments: () => readonly Comment[];
  readonly onRangesMapped: (updates: readonly CommentRangeUpdate[]) => void;
}

interface TrackedRange {
  readonly id: string;
  readonly blockId: string;
  readonly from: number;
  readonly to: number;
}

interface TrackedSpan {
  readonly id: string;
  readonly from: number;
  readonly to: number;
}

interface TrackingState {
  readonly ranges: readonly TrackedRange[];
  readonly spans: readonly TrackedSpan[];
}

const PLUGIN_KEY = new PluginKey<TrackingState>('mc-comment-range-mapping');

export const createCommentRangeMappingExtension = (handlers: CommentRangeMappingHandlers) =>
  Extension.create({
    name: COMMENT_RANGE_MAPPING_EXTENSION_NAME,
    addProseMirrorPlugins() {
      return [commentRangeMappingPlugin(handlers)];
    },
  });

const commentRangeMappingPlugin = (handlers: CommentRangeMappingHandlers): Plugin =>
  new Plugin({
    key: PLUGIN_KEY,
    state: {
      init: (_config, state) => trackAll(state.doc, handlers.getComments()),
      apply(tr, prev) {
        const reset = tr.getMeta(COMMENT_RANGE_MAPPING_META_KEY) as readonly Comment[] | undefined;
        if (reset) return trackAll(tr.doc, reset);
        if (!tr.docChanged) return prev;
        // why: assoc 1 on `from` means text typed exactly at the range's
        //      start slides the start forward (new text lands *before*
        //      the range, not inside it); assoc -1 on `to` means text
        //      typed exactly at the end stays out of the range too —
        //      together they keep the range pinned to the original
        //      commented characters instead of growing on every edit at
        //      either edge.
        const mapPos = (t: { from: number; to: number }): { from: number; to: number } => ({
          from: tr.mapping.map(t.from, 1),
          to: tr.mapping.map(t.to, -1),
        });
        return {
          ranges: prev.ranges.map((t) => ({ ...t, ...mapPos(t) })),
          spans: prev.spans.map((t) => ({ ...t, ...mapPos(t) })),
        };
      },
    },
    view() {
      return {
        update: (view) => {
          const tracked = PLUGIN_KEY.getState(view.state);
          if (!tracked || (tracked.ranges.length === 0 && tracked.spans.length === 0)) return;
          const comments = handlers.getComments();
          const updates = [
            ...collectUpdates(view.state.doc, tracked.ranges, comments),
            ...collectSpanUpdates(view.state.doc, tracked.spans, comments),
          ];
          if (updates.length > 0) handlers.onRangesMapped(updates);
        },
      };
    },
  });

const trackAll = (doc: PMNode, comments: readonly Comment[]): TrackingState => ({
  ranges: trackRanges(doc, comments),
  spans: trackSpans(doc, comments),
});

const trackRanges = (doc: PMNode, comments: readonly Comment[]): readonly TrackedRange[] => {
  const tracked: TrackedRange[] = [];
  const blockStarts = collectBlockStarts(doc);
  for (const c of comments) {
    if (c.anchorType !== 'block' || !c.range || c.orphaned) continue;
    const blockStart = blockStarts.get(c.anchor);
    if (blockStart === undefined) continue;
    const contentStart = blockStart + 1;
    tracked.push({
      id: c.id,
      blockId: c.anchor,
      from: contentStart + c.range.from,
      to: contentStart + c.range.to,
    });
  }
  return tracked;
};

const trackSpans = (doc: PMNode, comments: readonly Comment[]): readonly TrackedSpan[] => {
  const tracked: TrackedSpan[] = [];
  const blockStarts = collectBlockStarts(doc);
  for (const c of comments) {
    if (c.anchorType !== 'range' || !c.span || c.orphaned) continue;
    const startBlockStart = blockStarts.get(c.span.startBlockId);
    const endBlockStart = blockStarts.get(c.span.endBlockId);
    if (startBlockStart === undefined || endBlockStart === undefined) continue;
    tracked.push({
      id: c.id,
      from: startBlockStart + 1 + c.span.startOffset,
      to: endBlockStart + 1 + c.span.endOffset,
    });
  }
  return tracked;
};

const collectBlockStarts = (doc: PMNode): Map<string, number> => {
  const starts = new Map<string, number>();
  doc.descendants((node, pos) => {
    const id = node.attrs[BLOCK_ID_ATTR] as string | null;
    if (id) starts.set(id, pos);
    return true;
  });
  return starts;
};

interface BlockAt {
  readonly id: string;
  readonly contentStart: number;
}

// Reverse lookup: which block (if any) currently contains absolute
// position `pos`. Used by `collectSpanUpdates` since a span's endpoints
// aren't pinned to a single known block id the way a single-block range's
// are — edits can shift which block owns a given offset.
const blockContaining = (doc: PMNode, pos: number): BlockAt | null => {
  let found: BlockAt | null = null;
  doc.descendants((node, nodePos) => {
    if (found) return false;
    const id = node.attrs[BLOCK_ID_ATTR] as string | null;
    if (!id) return true;
    const contentStart = nodePos + 1;
    const contentEnd = nodePos + node.nodeSize - 1;
    if (pos >= contentStart && pos <= contentEnd) found = { id, contentStart };
    return true;
  });
  return found;
};

const collectUpdates = (
  doc: PMNode,
  tracked: readonly TrackedRange[],
  comments: readonly Comment[],
): readonly CommentRangeUpdate[] => {
  const blockStarts = collectBlockStarts(doc);
  const updates: CommentRangeUpdate[] = [];
  for (const t of tracked) {
    const current = comments.find((c) => c.id === t.id);
    // why: skip comments already marked orphaned — without this guard, a
    //      collapsed range keeps re-emitting the same `{ orphaned: true }`
    //      update on *every* subsequent dispatch (including the one
    //      `onRangesMapped` itself triggers via pushClouds), recursing
    //      synchronously until the call stack overflows.
    if (!current?.range || current.orphaned) continue;
    const blockStart = blockStarts.get(t.blockId);
    // why: the block itself vanishing is the existing block-anchor orphan
    //      path (comments-orphans.ts); this plugin only owns the
    //      collapsed-range case for a block that still exists.
    if (blockStart === undefined) continue;
    const contentStart = blockStart + 1;
    const from = Math.max(0, t.from - contentStart);
    const to = Math.max(0, t.to - contentStart);
    if (to <= from) {
      updates.push({ id: t.id, orphaned: true });
      continue;
    }
    if (current.range.from !== from || current.range.to !== to) {
      updates.push({ id: t.id, range: { from, to } });
    }
  }
  return updates;
};

const collectSpanUpdates = (
  doc: PMNode,
  tracked: readonly TrackedSpan[],
  comments: readonly Comment[],
): readonly CommentRangeUpdate[] => {
  const updates: CommentRangeUpdate[] = [];
  for (const t of tracked) {
    const current = comments.find((c) => c.id === t.id);
    if (!current?.span || current.orphaned) continue;
    if (t.to <= t.from) {
      updates.push({ id: t.id, orphaned: true });
      continue;
    }
    const start = blockContaining(doc, t.from);
    const end = blockContaining(doc, t.to);
    // why: a missing endpoint block is the existing block-anchor orphan
    //      path (comments-orphans.ts, extended for `range` in 19.16e-iii);
    //      this plugin only owns the collapsed-span case for blocks that
    //      still exist.
    if (!start || !end) continue;
    const span: CommentSpan = {
      startBlockId: start.id,
      startOffset: t.from - start.contentStart,
      endBlockId: end.id,
      endOffset: t.to - end.contentStart,
    };
    if (!spanEquals(current.span, span)) updates.push({ id: t.id, span });
  }
  return updates;
};

const spanEquals = (a: CommentSpan, b: CommentSpan): boolean =>
  a.startBlockId === b.startBlockId &&
  a.startOffset === b.startOffset &&
  a.endBlockId === b.endBlockId &&
  a.endOffset === b.endOffset;
