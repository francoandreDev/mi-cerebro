// Model for 13d (anchored drafts / track-changes). Each entity owns one
// file `drafts/<entityId>.json` on the `variant/<family>/draft` branch.
// The file is never present in the working tree; it lives only in the
// git object DB and is read/written via plumbing (no checkout).

import type { JSONContent } from '@tiptap/core';

export const DRAFTS_FILE_SCHEMA_VERSION = 1 as const;

export const DRAFTS_DIR = 'drafts';

export const draftsFilepath = (entityId: string): string => `${DRAFTS_DIR}/${entityId}.json`;

// 'doc'   → anchor === entityId, the mark proposes a change spanning the
//           whole entity. Used when the editor cannot localize the diff
//           to a specific block (rare; fallback).
// 'block' → anchor === blockId from BLOCK_ID_ATTR. The mark stays tied
//           to the block; if the block is deleted before accept, the
//           mark becomes invalid and the panel flags it.
export type DraftAnchorType = 'doc' | 'block';

// `before` / `after` carry the bloque-level JSONContent slice the user
// proposes to replace. Empty `before` with non-empty `after` → insertion;
// the reverse → deletion; both non-empty → mutation. The renderer in
// 13d-iii uses this shape directly to pick ghost vs strikethrough.
export interface DiffMark {
  readonly id: string;
  readonly anchorType: DraftAnchorType;
  readonly anchor: string;
  readonly before: JSONContent;
  readonly after: JSONContent;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DraftsFile {
  readonly schemaVersion: typeof DRAFTS_FILE_SCHEMA_VERSION;
  readonly entityId: string;
  readonly marks: readonly DiffMark[];
}

export const emptyDraftsFile = (entityId: string): DraftsFile => ({
  schemaVersion: DRAFTS_FILE_SCHEMA_VERSION,
  entityId,
  marks: [],
});
