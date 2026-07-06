// 13f — Position helpers for the editor's overlays. The bubble menu and
// the comment popover need coordinates in the host's local space so they
// can be absolutely positioned. Kept as pure functions so the component
// doesn't carry geometry math in its body.

import type { Editor } from '@tiptap/core';
import type { ResolvedPos } from '@tiptap/pm/model';

import { BLOCK_ID_ATTR } from '@core/tiptap/block-id/block-id.types';
import type { CommentSpan } from '@core/versioning/comments.types';

export interface LocalPosition {
  readonly top: number;
  readonly left: number;
}

export const selectionRect = (editor: Editor, host: HTMLElement): LocalPosition => {
  const { from, to } = editor.state.selection;
  const start = editor.view.coordsAtPos(from);
  const end = editor.view.coordsAtPos(to);
  const hostRect = host.getBoundingClientRect();
  return {
    top: Math.max(start.bottom, end.bottom) - hostRect.top + 6,
    left: (start.left + end.right) / 2 - hostRect.left,
  };
};

export const blockIdAtSelection = (editor: Editor): string | null => {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth >= 0; depth--) {
    const node = $from.node(depth);
    const id = node.attrs?.[BLOCK_ID_ATTR] as string | undefined;
    if (id) return id;
  }
  return null;
};

// 13g-i — Offsets of the current selection relative to the start of the
// block's content. Returns null when the selection is empty or doesn't sit
// inside a block with an id. Both endpoints are clamped to the block.
export const rangeWithinBlockAtSelection = (
  editor: Editor,
): { from: number; to: number } | null => {
  const sel = editor.state.selection;
  if (sel.from === sel.to) return null;
  const $from = sel.$from;
  for (let depth = $from.depth; depth >= 0; depth--) {
    const node = $from.node(depth);
    const id = node.attrs?.[BLOCK_ID_ATTR] as string | undefined;
    if (!id) continue;
    const blockContentStart = $from.start(depth);
    const blockContentEnd = blockContentStart + node.content.size;
    const from = Math.max(0, sel.from - blockContentStart);
    const to = Math.max(
      from,
      Math.min(blockContentEnd - blockContentStart, sel.to - blockContentStart),
    );
    if (to <= from) return null;
    return { from, to };
  }
  return null;
};

// 19.16e-iii — Span of the current selection when it crosses two or more
// blocks. Returns null when the selection is empty or confined to a single
// block (the existing `rangeWithinBlockAtSelection` path handles that
// case). Each endpoint's offset is relative to its own block's content
// start, clamped to that block's bounds.
export const blockSpanAtSelection = (editor: Editor): CommentSpan | null => {
  const sel = editor.state.selection;
  if (sel.from === sel.to) return null;
  const start = blockBoundsAt(sel.$from);
  if (!start) return null;
  const end = blockBoundsAt(editor.state.doc.resolve(sel.to));
  if (!end || start.id === end.id) return null;
  return {
    startBlockId: start.id,
    startOffset: Math.max(0, sel.from - start.contentStart),
    endBlockId: end.id,
    endOffset: Math.max(0, Math.min(end.contentEnd - end.contentStart, sel.to - end.contentStart)),
  };
};

interface BlockBounds {
  readonly id: string;
  readonly contentStart: number;
  readonly contentEnd: number;
}

const blockBoundsAt = ($pos: ResolvedPos): BlockBounds | null => {
  for (let depth = $pos.depth; depth >= 0; depth--) {
    const node = $pos.node(depth);
    const id = node.attrs?.[BLOCK_ID_ATTR] as string | undefined;
    if (!id) continue;
    const contentStart = $pos.start(depth);
    return { id, contentStart, contentEnd: contentStart + node.content.size };
  }
  return null;
};

export const cloudRect = (host: HTMLElement, commentId: string): LocalPosition => {
  const cloud = host.querySelector(`.mc-comment-cloud[data-comment-id="${commentId}"]`);
  if (!cloud) return { top: 0, left: 0 };
  const rect = cloud.getBoundingClientRect();
  const hostRect = host.getBoundingClientRect();
  return { top: rect.bottom - hostRect.top + 6, left: rect.left - hostRect.left };
};
