// 19.16e-iv — JSON→DOM mini-renderer for insertion-only diff-marks. `after`
// is a single block-level node (paragraph/heading/blockquote/list/codeBlock/
// horizontalRule — whatever the top-level doc accepts, per draft-apply.ts),
// never a full doc. Covers the node/mark set StarterKit + the highlight
// extension actually produce; anything else falls back to a generic `div`
// so an unexpected node type still renders its text instead of throwing.

import type { JSONContent } from '@tiptap/core';

import { HIGHLIGHT_COLOR_ATTR } from '../highlight/highlight.ext';

const NODE_TAGS: Record<string, string> = {
  paragraph: 'p',
  blockquote: 'blockquote',
  bulletList: 'ul',
  orderedList: 'ol',
  listItem: 'li',
};

const MARK_TAGS: Record<string, string> = {
  bold: 'strong',
  italic: 'em',
  strike: 's',
  code: 'code',
};

export const renderDiffMarkPreview = (node: JSONContent): HTMLElement => renderNode(node);

function renderNode(node: JSONContent): HTMLElement {
  if (node.type === 'horizontalRule') return document.createElement('hr');
  if (node.type === 'codeBlock') return renderCodeBlock(node);
  const el = document.createElement(tagFor(node));
  for (const child of node.content ?? []) {
    el.appendChild(child.type === 'text' ? renderText(child) : renderNode(child));
  }
  return el;
}

function renderCodeBlock(node: JSONContent): HTMLElement {
  const pre = document.createElement('pre');
  const code = document.createElement('code');
  code.textContent = (node.content ?? []).map((c) => c.text ?? '').join('');
  pre.appendChild(code);
  return pre;
}

function tagFor(node: JSONContent): string {
  if (node.type === 'heading') {
    const level = Number(node.attrs?.['level'] ?? 1);
    return `h${Math.min(Math.max(level, 1), 6)}`;
  }
  return NODE_TAGS[node.type ?? ''] ?? 'div';
}

function renderText(node: JSONContent): Node {
  let el: Node = document.createTextNode(node.text ?? '');
  for (const mark of node.marks ?? []) {
    if (mark.type === 'highlight') {
      el = wrapMark('mark', el, (mark.attrs?.['color'] as string | null) ?? null);
      continue;
    }
    const tag = MARK_TAGS[mark.type];
    if (tag) el = wrapMark(tag, el, null);
  }
  return el;
}

function wrapMark(tag: string, child: Node, highlightColor: string | null): HTMLElement {
  const wrapper = document.createElement(tag);
  if (highlightColor) wrapper.setAttribute(HIGHLIGHT_COLOR_ATTR, highlightColor);
  wrapper.appendChild(child);
  return wrapper;
}
