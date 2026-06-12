// 13d-ii — pure helpers to turn a (before, after) snapshot pair into
// the DiffMark list that DraftsService persists. Top-level blocks are
// keyed by their stable `blockId` (from the block-id extension); a
// missing block on one side means "insertion" or "deletion". Blocks
// without a blockId are skipped — the extension assigns one on the
// very next transaction so this is only a transient state.

import type { JSONContent } from '@tiptap/core';

import { BLOCK_ID_ATTR } from '@core/tiptap/block-id/block-id.types';

import type { DiffMark } from './drafts.types';

const EMPTY_BLOCK: JSONContent = { type: 'paragraph' };

export interface BuildBlockDiffMarksInput {
  readonly before: JSONContent;
  readonly after: JSONContent;
  readonly now: string;
  readonly genId: () => string;
}

export function buildBlockDiffMarks(input: BuildBlockDiffMarksInput): DiffMark[] {
  const before = blockMap(input.before);
  const after = blockMap(input.after);
  const ids = new Set<string>([...before.keys(), ...after.keys()]);
  const marks: DiffMark[] = [];
  for (const id of ids) {
    const b = before.get(id);
    const a = after.get(id);
    if (b && a && jsonEquals(b, a)) continue;
    marks.push({
      id: input.genId(),
      anchorType: 'block',
      anchor: id,
      before: b ?? EMPTY_BLOCK,
      after: a ?? EMPTY_BLOCK,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }
  return marks;
}

function blockMap(doc: JSONContent): Map<string, JSONContent> {
  const out = new Map<string, JSONContent>();
  for (const node of doc.content ?? []) {
    const id = node.attrs?.[BLOCK_ID_ATTR];
    if (typeof id === 'string' && id.length > 0) out.set(id, node);
  }
  return out;
}

function jsonEquals(a: JSONContent, b: JSONContent): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
