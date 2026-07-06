// 13f — Inline comment cloud rendering. For every block-anchored comment
// whose blockId matches a node in the doc, a widget decoration drops a
// clickable SVG cloud at the end of that block. Click delegates to a host
// callback (the editor component) which opens the comment popover. The
// widget is purely a visual affordance; the underlying text is not
// highlighted or underlined — the cloud carries all the signal.
//
// 19.16e-iii — `range`-anchored comments (multi-block spans) render the
// same cloud widget at the end of the *last* block in the span, plus an
// inline decoration that underlines the whole span. A single ProseMirror
// inline decoration can freely cross node boundaries, so no per-block
// clamping is needed there (only the widget position is clamped, to the
// end block's own bounds). Entity-anchored comments are skipped here; they
// show up only in the popover index.

import { Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

import { BLOCK_ID_ATTR } from '../block-id/block-id.types';

import type { Comment, CommentSpan } from '@core/versioning/comments.types';

export const COMMENT_CLOUDS_EXTENSION_NAME = 'mcCommentClouds';
export const COMMENT_CLOUDS_META_KEY = 'mc-comment-clouds.set';

const PLUGIN_KEY = new PluginKey<DecorationSet>('mc-comment-clouds');

export interface CommentCloudHandlers {
  readonly onClick: (commentId: string) => void;
  readonly ariaLabel: () => string;
}

export const createCommentCloudsExtension = (handlers: CommentCloudHandlers) =>
  Extension.create({
    name: COMMENT_CLOUDS_EXTENSION_NAME,
    addProseMirrorPlugins() {
      return [commentCloudsPlugin(handlers)];
    },
  });

const commentCloudsPlugin = (handlers: CommentCloudHandlers): Plugin<DecorationSet> =>
  new Plugin<DecorationSet>({
    key: PLUGIN_KEY,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, prev) {
        const next = tr.getMeta(COMMENT_CLOUDS_META_KEY) as readonly Comment[] | undefined;
        if (next) return buildDecorations(tr.doc, next, handlers);
        return tr.docChanged ? prev.map(tr.mapping, tr.doc) : prev;
      },
    },
    props: {
      decorations(state) {
        return this.getState(state) ?? DecorationSet.empty;
      },
    },
  });

interface BlockBounds {
  readonly contentStart: number;
  readonly contentEnd: number;
}

const buildDecorations = (
  doc: PMNode,
  comments: readonly Comment[],
  handlers: CommentCloudHandlers,
): DecorationSet => {
  const relevant = comments.filter(
    (c) => !c.orphaned && (c.anchorType === 'block' || c.anchorType === 'range'),
  );
  if (relevant.length === 0) return DecorationSet.empty;
  const blocks = collectBlockBounds(doc);
  const decorations: Decoration[] = [];
  for (const comment of relevant) {
    if (comment.anchorType === 'block') addBlockDecorations(decorations, blocks, comment, handlers);
    else if (comment.span) addSpanDecorations(decorations, blocks, comment, comment.span, handlers);
  }
  return DecorationSet.create(doc, decorations);
};

const collectBlockBounds = (doc: PMNode): Map<string, BlockBounds> => {
  const map = new Map<string, BlockBounds>();
  doc.descendants((node, pos) => {
    const id = node.attrs[BLOCK_ID_ATTR] as string | null;
    if (id) map.set(id, { contentStart: pos + 1, contentEnd: pos + node.nodeSize - 1 });
    return true;
  });
  return map;
};

const addBlockDecorations = (
  decorations: Decoration[],
  blocks: Map<string, BlockBounds>,
  comment: Comment,
  handlers: CommentCloudHandlers,
): void => {
  const bounds = blocks.get(comment.anchor);
  if (!bounds) return;
  const range = comment.range;
  // why: when a range is present we anchor the cloud at the end of the
  //      selected span (clamped to the block) and add an inline decoration
  //      so the user can see *which words* were commented. Without a range
  //      we keep the legacy end-of-block placement.
  const cloudPos = range
    ? Math.min(bounds.contentEnd, bounds.contentStart + range.to)
    : bounds.contentEnd;
  decorations.push(cloudDecoration(cloudPos, comment.id, handlers));
  if (range) {
    const fromPos = Math.min(bounds.contentEnd, bounds.contentStart + range.from);
    const toPos = Math.min(bounds.contentEnd, bounds.contentStart + range.to);
    if (toPos > fromPos) decorations.push(rangeDecoration(fromPos, toPos, comment.id));
  }
};

// 19.16e-iii — the cloud renders at the end of the *last* block in the
// span; the inline decoration underlines the whole span across every
// block it crosses.
const addSpanDecorations = (
  decorations: Decoration[],
  blocks: Map<string, BlockBounds>,
  comment: Comment,
  span: CommentSpan,
  handlers: CommentCloudHandlers,
): void => {
  const start = blocks.get(span.startBlockId);
  const end = blocks.get(span.endBlockId);
  if (!start || !end) return;
  const fromPos = Math.min(start.contentEnd, start.contentStart + span.startOffset);
  const toPos = Math.min(end.contentEnd, end.contentStart + span.endOffset);
  if (toPos <= fromPos) return;
  decorations.push(cloudDecoration(toPos, comment.id, handlers));
  decorations.push(rangeDecoration(fromPos, toPos, comment.id));
};

// why: side -1 places the widget *before* the cursor slot so pressing End /
//      clicking past the cloud lands the caret after it, not before. With
//      side +1 the caret got stuck on the wrong side and the cloud's hitbox
//      absorbed the click.
const cloudDecoration = (
  pos: number,
  commentId: string,
  handlers: CommentCloudHandlers,
): Decoration =>
  Decoration.widget(pos, () => buildCloudButton(commentId, handlers), {
    side: -1,
    key: `cloud-${commentId}`,
    ignoreSelection: true,
  });

const rangeDecoration = (from: number, to: number, commentId: string): Decoration =>
  Decoration.inline(from, to, { class: 'mc-comment-range', 'data-comment-id': commentId });

const buildCloudButton = (commentId: string, handlers: CommentCloudHandlers): HTMLElement => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'mc-comment-cloud';
  btn.setAttribute('data-comment-id', commentId);
  btn.setAttribute('aria-label', handlers.ariaLabel());
  // why: the widget sits inside the editable surface; without
  //      contenteditable=false ProseMirror tries to include it in cursor
  //      navigation and the caret can't land on either side of it.
  btn.setAttribute('contenteditable', 'false');
  btn.innerHTML = CLOUD_SVG;
  btn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    handlers.onClick(commentId);
  });
  // why: pointer events from ProseMirror try to refocus the editor on
  //      mousedown; swallow it so the popover opens cleanly.
  btn.addEventListener('mousedown', (event) => event.stopPropagation());
  return btn;
};

const CLOUD_SVG = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6 8.5 4 4 0 0 0 7 17Z"/></svg>`;
