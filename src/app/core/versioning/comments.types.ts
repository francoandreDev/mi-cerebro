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
// 'range'  is intentionally absent — diferido a pulido posterior (§19).
export type CommentAnchorType = 'entity' | 'block';

export interface Comment {
  readonly id: string;
  readonly anchorType: CommentAnchorType;
  readonly anchor: string;
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
