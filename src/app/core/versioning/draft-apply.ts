// 13d-iii — pure helpers for the drafts panel. `applyMarkToDoc` rewrites
// the top-level block list according to a single `DiffMark`:
//   - mutation (before non-empty, after non-empty): replace the block.
//   - deletion (after is the EMPTY_BLOCK paragraph): drop the block.
//   - insertion (before is the EMPTY_BLOCK paragraph): append the block.
// EMPTY_BLOCK is the sentinel `{ type: 'paragraph' }` that draft-capture
// emits when one side has no content for the anchor (see draft-capture.ts).
//
// `markCategory` classifies a mark for the panel UI / decoration extension.

import type { JSONContent } from '@tiptap/core';

import { BLOCK_ID_ATTR } from '@core/tiptap/block-id/block-id.types';

import type { DiffMark } from './drafts.types';

export type MarkCategory = 'insert' | 'delete' | 'mutate';

export function markCategory(mark: DiffMark): MarkCategory {
  const beforeEmpty = isEmptyBlock(mark.before);
  const afterEmpty = isEmptyBlock(mark.after);
  if (beforeEmpty && !afterEmpty) return 'insert';
  if (!beforeEmpty && afterEmpty) return 'delete';
  return 'mutate';
}

export function applyMarkToDoc(doc: JSONContent, mark: DiffMark): JSONContent {
  if (mark.anchorType !== 'block') return doc;
  const cat = markCategory(mark);
  const content = doc.content ?? [];
  if (cat === 'insert') {
    if (findBlockIndex(content, mark.anchor) !== -1) return doc;
    return { ...doc, content: [...content, mark.after] };
  }
  const idx = findBlockIndex(content, mark.anchor);
  if (idx === -1) return doc;
  if (cat === 'delete') {
    return { ...doc, content: [...content.slice(0, idx), ...content.slice(idx + 1)] };
  }
  return { ...doc, content: [...content.slice(0, idx), mark.after, ...content.slice(idx + 1)] };
}

function findBlockIndex(blocks: readonly JSONContent[], anchor: string): number {
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i]?.attrs?.[BLOCK_ID_ATTR] === anchor) return i;
  }
  return -1;
}

function isEmptyBlock(node: JSONContent): boolean {
  if (node.type !== 'paragraph') return false;
  const c = node.content;
  return !c || c.length === 0;
}
