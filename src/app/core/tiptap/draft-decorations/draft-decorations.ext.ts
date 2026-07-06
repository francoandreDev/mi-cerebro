// 13d-iii — ProseMirror decorations for pending draft marks. The editor
// asks the panel for the marks set; the extension exposes a single meta
// channel so the editor can push the latest list without re-creating the
// plugin. Node-class decorations (no DOM injection):
//
//   - mc-draft-mutate    → block exists in main with different content
//   - mc-draft-strike    → block scheduled for deletion (after empty)
//
// 19.16e-iv — insertions (block does not exist in main yet, so they have no
// inline anchor point) render as a widget decoration at the end of the doc
// instead — a ghost block preview built by the diff-mark-preview mini JSON→
// DOM renderer, clickable to jump to that mark in the drafts popover. This
// is where `applyMarkToDoc` actually lands them (appended at doc end), so
// the ghost sits where the accepted content would end up. Doc-anchored
// marks are ignored — they're a fallback shape, not a UI affordance here.

import { Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

import { BLOCK_ID_ATTR } from '../block-id/block-id.types';
import { renderDiffMarkPreview } from './diff-mark-preview';

import { markCategory } from '@core/versioning/draft-apply';
import type { DiffMark } from '@core/versioning/drafts.types';

export const DRAFT_DECORATIONS_EXTENSION_NAME = 'mcDraftDecorations';
export const DRAFT_DECORATIONS_META_KEY = 'mc-draft-decorations.set';

export interface DraftInsertHandlers {
  readonly onClick: (markId: string) => void;
  readonly ariaLabel: () => string;
}

const PLUGIN_KEY = new PluginKey<DecorationSet>('mc-draft-decorations');

export const createDraftDecorationsExtension = (handlers: DraftInsertHandlers) =>
  Extension.create({
    name: DRAFT_DECORATIONS_EXTENSION_NAME,
    addProseMirrorPlugins() {
      return [draftDecorationsPlugin(handlers)];
    },
  });

const draftDecorationsPlugin = (handlers: DraftInsertHandlers): Plugin<DecorationSet> =>
  new Plugin<DecorationSet>({
    key: PLUGIN_KEY,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, prev) {
        const next = tr.getMeta(DRAFT_DECORATIONS_META_KEY) as readonly DiffMark[] | undefined;
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
  marks: readonly DiffMark[],
  handlers: DraftInsertHandlers,
): DecorationSet => {
  if (marks.length === 0) return DecorationSet.empty;
  const decorations: Decoration[] = [];
  addBlockDecorations(decorations, doc, marks);
  addInsertWidgets(decorations, doc, marks, handlers);
  return DecorationSet.create(doc, decorations);
};

const addBlockDecorations = (
  decorations: Decoration[],
  doc: PMNode,
  marks: readonly DiffMark[],
): void => {
  const byAnchor = new Map<string, DiffMark>();
  for (const m of marks) {
    if (m.anchorType === 'block') byAnchor.set(m.anchor, m);
  }
  if (byAnchor.size === 0) return;
  doc.descendants((node, pos) => {
    const id = node.attrs[BLOCK_ID_ATTR] as string | null;
    if (!id) return true;
    const mark = byAnchor.get(id);
    if (!mark) return true;
    const cat = markCategory(mark);
    if (cat === 'insert') return true;
    const cls = cat === 'delete' ? 'mc-draft-strike' : 'mc-draft-mutate';
    decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: cls }));
    return true;
  });
};

const addInsertWidgets = (
  decorations: Decoration[],
  doc: PMNode,
  marks: readonly DiffMark[],
  handlers: DraftInsertHandlers,
): void => {
  const endPos = doc.content.size;
  for (const mark of marks) {
    if (mark.anchorType !== 'block' || markCategory(mark) !== 'insert') continue;
    decorations.push(
      Decoration.widget(endPos, () => buildInsertWidget(mark, handlers), {
        side: 1,
        key: `draft-insert-${mark.id}`,
        ignoreSelection: true,
      }),
    );
  }
};

const buildInsertWidget = (mark: DiffMark, handlers: DraftInsertHandlers): HTMLElement => {
  const wrap = document.createElement('div');
  wrap.className = 'mc-draft-insert';
  wrap.setAttribute('contenteditable', 'false');
  wrap.setAttribute('role', 'button');
  wrap.setAttribute('tabindex', '0');
  wrap.setAttribute('data-draft-id', mark.id);
  wrap.setAttribute('aria-label', handlers.ariaLabel());
  wrap.appendChild(renderDiffMarkPreview(mark.after));
  wrap.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    handlers.onClick(mark.id);
  });
  // why: pointer events from ProseMirror try to refocus the editor on
  //      mousedown; swallow it so the click reaches the panel cleanly
  //      (same guard used by the comment cloud button).
  wrap.addEventListener('mousedown', (event) => event.stopPropagation());
  return wrap;
};
