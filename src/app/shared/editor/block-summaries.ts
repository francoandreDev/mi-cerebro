// Walks a TipTap doc and emits a short, document-order preview of every
// block that carries a stable id. Used by the comments panel to populate
// the "anchor to which block" picker without coupling the panel to
// ProseMirror internals.

import type { JSONContent } from '@tiptap/core';

import { BLOCK_ID_ATTR, BLOCK_ID_TARGET_TYPES } from '@core/tiptap/block-id/block-id.types';

export interface BlockSummary {
  readonly blockId: string;
  readonly type: string;
  readonly preview: string;
}

const PREVIEW_MAX = 60;

export function extractBlockSummaries(doc: JSONContent | undefined): readonly BlockSummary[] {
  if (!doc) return [];
  const out: BlockSummary[] = [];
  walk(doc, out);
  return out;
}

function walk(node: JSONContent, out: BlockSummary[]): void {
  const id = node.attrs?.[BLOCK_ID_ATTR];
  if (
    typeof id === 'string' &&
    id.length > 0 &&
    node.type &&
    BLOCK_ID_TARGET_TYPES.has(node.type)
  ) {
    out.push({ blockId: id, type: node.type, preview: previewOf(node) });
  }
  for (const child of node.content ?? []) walk(child, out);
}

function previewOf(node: JSONContent): string {
  const text = collectText(node).replace(/\s+/g, ' ').trim();
  if (text.length === 0) return '';
  return text.length > PREVIEW_MAX ? `${text.slice(0, PREVIEW_MAX - 1)}…` : text;
}

function collectText(node: JSONContent): string {
  if (typeof node.text === 'string') return node.text;
  let out = '';
  for (const child of node.content ?? []) out += collectText(child);
  return out;
}
