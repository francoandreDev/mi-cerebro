// Model for 13c (anchored comments). Each entity owns one file
// `comments/<entityId>.json` on the `variant/<family>/comments` branch.
// The file is never present in the working tree; it lives only in the
// git object DB and is read/written via plumbing (no checkout).

import type { JSONContent } from '@tiptap/core';

export const COMMENTS_FILE_SCHEMA_VERSION = 1 as const;

export const COMMENTS_DIR = 'comments';

export const commentsFilepath = (entityId: string): string => `${COMMENTS_DIR}/${entityId}.json`;

// 'entity' → anchor === entityId, comment applies to the whole entity.
// 'block'  → anchor === blockId from the BLOCK_ID_ATTR extension. The
//            anchor sticks to the block across edits; if the block is
//            deleted, the comment is marked `orphaned: true`.
// 'range'  → 19.16e-iii, a selection crossing two or more blocks. `anchor`
//            mirrors `span.endBlockId` (so `block`-only consumers that just
//            read `anchor` still get a sensible single id); the full shape
//            lives in `span`.
export type CommentAnchorType = 'entity' | 'block' | 'range';

// 13g-i — Optional offsets *within* the anchor block's content (ProseMirror
// positions relative to `blockStart + 1`). When present, the cloud is
// rendered at `range.to` instead of the block end, and an inline decoration
// underlines [from, to). Backwards-compatible: legacy block-anchored
// comments simply lack the field and keep their old end-of-block behavior.
export interface CommentRange {
  readonly from: number;
  readonly to: number;
}

// 19.16e-iii — Anchor shape for a comment whose selection crosses block
// boundaries. Offsets are relative to each endpoint block's own content
// start, mirroring `CommentRange`. A middle block being deleted does not
// orphan the comment (the span just spans less content); the comment only
// orphans when `startBlockId` or `endBlockId` itself is gone, or when the
// mapped span collapses (`endOffset <= startOffset` once both resolve into
// the same block).
export interface CommentSpan {
  readonly startBlockId: string;
  readonly startOffset: number;
  readonly endBlockId: string;
  readonly endOffset: number;
}

export interface Comment {
  readonly id: string;
  readonly anchorType: CommentAnchorType;
  readonly anchor: string;
  readonly range?: CommentRange;
  readonly span?: CommentSpan;
  readonly body: JSONContent;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly orphaned: boolean;
}

export interface CommentsFile {
  readonly schemaVersion: typeof COMMENTS_FILE_SCHEMA_VERSION;
  readonly entityId: string;
  readonly comments: readonly Comment[];
}

export const emptyCommentsFile = (entityId: string): CommentsFile => ({
  schemaVersion: COMMENTS_FILE_SCHEMA_VERSION,
  entityId,
  comments: [],
});
