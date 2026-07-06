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

import { Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';

import { BLOCK_ID_ATTR } from '../block-id/block-id.types';

import type { Comment, CommentRange } from '@core/versioning/comments.types';

export const COMMENT_RANGE_MAPPING_EXTENSION_NAME = 'mcCommentRangeMapping';
export const COMMENT_RANGE_MAPPING_META_KEY = 'mc-comment-range-mapping.set';

export type CommentRangeUpdate =
  | { readonly id: string; readonly range: CommentRange }
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

const PLUGIN_KEY = new PluginKey<readonly TrackedRange[]>('mc-comment-range-mapping');

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
      init: (_config, state) => trackRanges(state.doc, handlers.getComments()),
      apply(tr, prev) {
        const reset = tr.getMeta(COMMENT_RANGE_MAPPING_META_KEY) as readonly Comment[] | undefined;
        if (reset) return trackRanges(tr.doc, reset);
        if (!tr.docChanged) return prev;
        return prev.map((t) => ({
          ...t,
          // why: assoc 1 on `from` means text typed exactly at the range's
          //      start slides the start forward (new text lands *before*
          //      the range, not inside it); assoc -1 on `to` means text
          //      typed exactly at the end stays out of the range too —
          //      together they keep the range pinned to the original
          //      commented characters instead of growing on every edit at
          //      either edge.
          from: tr.mapping.map(t.from, 1),
          to: tr.mapping.map(t.to, -1),
        }));
      },
    },
    view() {
      return {
        update: (view) => {
          const tracked = PLUGIN_KEY.getState(view.state);
          if (!tracked || tracked.length === 0) return;
          const updates = collectUpdates(view.state.doc, tracked, handlers.getComments());
          if (updates.length > 0) handlers.onRangesMapped(updates);
        },
      };
    },
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

const collectBlockStarts = (doc: PMNode): Map<string, number> => {
  const starts = new Map<string, number>();
  doc.descendants((node, pos) => {
    const id = node.attrs[BLOCK_ID_ATTR] as string | null;
    if (id) starts.set(id, pos);
    return true;
  });
  return starts;
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
