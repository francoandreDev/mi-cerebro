// 13f — Position helpers for the editor's overlays. The bubble menu and
// the comment popover need coordinates in the host's local space so they
// can be absolutely positioned. Kept as pure functions so the component
// doesn't carry geometry math in its body.

import type { Editor } from '@tiptap/core';

import { BLOCK_ID_ATTR } from '@core/tiptap/block-id/block-id.types';

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

export const cloudRect = (host: HTMLElement, commentId: string): LocalPosition => {
  const cloud = host.querySelector(`.mc-comment-cloud[data-comment-id="${commentId}"]`);
  if (!cloud) return { top: 0, left: 0 };
  const rect = cloud.getBoundingClientRect();
  const hostRect = host.getBoundingClientRect();
  return { top: rect.bottom - hostRect.top + 6, left: rect.left - hostRect.left };
};
