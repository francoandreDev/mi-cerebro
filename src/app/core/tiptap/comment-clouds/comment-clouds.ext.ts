// 13f — Inline comment cloud rendering. For every block-anchored comment
// whose blockId matches a node in the doc, a widget decoration drops a
// clickable SVG cloud at the end of that block. Click delegates to a host
// callback (the editor component) which opens the comment popover. The
// widget is purely a visual affordance; the underlying text is not
// highlighted or underlined — the cloud carries all the signal.
//
// Range-anchored comments are deferred (docs/deferred.md). Entity-anchored
// comments are skipped here; they show up only in the popover index.

import { Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

import { BLOCK_ID_ATTR } from '../block-id/block-id.types';

import type { Comment } from '@core/versioning/comments.types';

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

const buildDecorations = (
  doc: PMNode,
  comments: readonly Comment[],
  handlers: CommentCloudHandlers,
): DecorationSet => {
  const byBlock = new Map<string, Comment[]>();
  for (const c of comments) {
    if (c.orphaned) continue;
    if (c.anchorType !== 'block') continue;
    const list = byBlock.get(c.anchor) ?? [];
    list.push(c);
    byBlock.set(c.anchor, list);
  }
  if (byBlock.size === 0) return DecorationSet.empty;
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    const id = node.attrs[BLOCK_ID_ATTR] as string | null;
    if (!id) return true;
    const matches = byBlock.get(id);
    if (!matches || matches.length === 0) return true;
    const blockContentStart = pos + 1;
    const blockContentEnd = pos + node.nodeSize - 1;
    for (const comment of matches) {
      const range = comment.range;
      // why: when a range is present we anchor the cloud at the end of the
      //      selected span (clamped to the block) and add an inline
      //      decoration so the user can see *which words* were commented.
      //      Without a range we keep the legacy end-of-block placement.
      const cloudPos = range
        ? Math.min(blockContentEnd, blockContentStart + range.to)
        : blockContentEnd;
      decorations.push(
        // why: side -1 places the widget *before* the cursor slot so
        //      pressing End / clicking past the cloud lands the caret after
        //      it, not before. With side +1 the caret got stuck on the
        //      wrong side and the cloud's hitbox absorbed the click.
        Decoration.widget(cloudPos, () => buildCloudButton(comment.id, handlers), {
          side: -1,
          key: `cloud-${comment.id}`,
          ignoreSelection: true,
        }),
      );
      if (range) {
        const fromPos = Math.min(blockContentEnd, blockContentStart + range.from);
        const toPos = Math.min(blockContentEnd, blockContentStart + range.to);
        if (toPos > fromPos) {
          decorations.push(
            Decoration.inline(fromPos, toPos, {
              class: 'mc-comment-range',
              'data-comment-id': comment.id,
            }),
          );
        }
      }
    }
    return true;
  });
  return DecorationSet.create(doc, decorations);
};

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
