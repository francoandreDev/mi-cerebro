// 13d-iii — ProseMirror decorations for pending draft marks. The editor
// asks the panel for the marks set; the extension exposes a single meta
// channel so the editor can push the latest list without re-creating the
// plugin. Decorations are pure node-class additions (no DOM injection):
//
//   - mc-draft-mutate    → block exists in main with different content
//   - mc-draft-strike    → block scheduled for deletion (after empty)
//
// Insertions (block does not exist in main yet) get no inline rendering:
// they are surfaced by the side panel only. Doc-anchored marks are
// ignored — they're a fallback shape, not a UI affordance here.

import { Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

import { BLOCK_ID_ATTR } from '../block-id/block-id.types';

import { markCategory } from '@core/versioning/draft-apply';
import type { DiffMark } from '@core/versioning/drafts.types';

export const DRAFT_DECORATIONS_EXTENSION_NAME = 'mcDraftDecorations';
export const DRAFT_DECORATIONS_META_KEY = 'mc-draft-decorations.set';

const PLUGIN_KEY = new PluginKey<DecorationSet>('mc-draft-decorations');

export const createDraftDecorationsExtension = () =>
  Extension.create({
    name: DRAFT_DECORATIONS_EXTENSION_NAME,
    addProseMirrorPlugins() {
      return [draftDecorationsPlugin()];
    },
  });

const draftDecorationsPlugin = (): Plugin<DecorationSet> =>
  new Plugin<DecorationSet>({
    key: PLUGIN_KEY,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, prev) {
        const next = tr.getMeta(DRAFT_DECORATIONS_META_KEY) as readonly DiffMark[] | undefined;
        if (next) return buildDecorations(tr.doc, next);
        return tr.docChanged ? prev.map(tr.mapping, tr.doc) : prev;
      },
    },
    props: {
      decorations(state) {
        return this.getState(state) ?? DecorationSet.empty;
      },
    },
  });

const buildDecorations = (doc: PMNode, marks: readonly DiffMark[]): DecorationSet => {
  if (marks.length === 0) return DecorationSet.empty;
  const byAnchor = new Map<string, DiffMark>();
  for (const m of marks) {
    if (m.anchorType === 'block') byAnchor.set(m.anchor, m);
  }
  if (byAnchor.size === 0) return DecorationSet.empty;
  const decorations: Decoration[] = [];
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
  return DecorationSet.create(doc, decorations);
};
