// why: typewriter mode dims every block except the one holding the cursor
//      (docs/deferred/trash-books.md "Typewriter focus línea-por-línea").
//      Same reasoning as tts-highlight.ext.ts / bookmark-pin.ext.ts: a class
//      applied by hand via classList disappears on the next ProseMirror
//      transaction (the reconciler rewrites the node's subtree from its own
//      model), so this has to be a decoration plugin. Unlike those two, the
//      "active" id isn't pushed from outside — the plugin tracks the
//      selection's block itself (same trick as bookmark-pin's `selectedId`)
//      and only the on/off flag comes in via meta from EditorComponent.

import { Extension } from '@tiptap/core';
import type { Node as PMNode, ResolvedPos } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

import { BLOCK_ID_ATTR, BLOCK_ID_TARGET_TYPES } from '../block-id/block-id.types';

export const TYPEWRITER_FOCUS_EXTENSION_NAME = 'mcTypewriterFocus';
export const TYPEWRITER_FOCUS_META_KEY = 'mc-typewriter-focus.enabled';

interface TypewriterState {
  readonly enabled: boolean;
  readonly activeId: string | null;
}

const PLUGIN_KEY = new PluginKey<TypewriterState>('mc-typewriter-focus');

export const createTypewriterFocusExtension = () =>
  Extension.create({
    name: TYPEWRITER_FOCUS_EXTENSION_NAME,
    addProseMirrorPlugins() {
      return [typewriterFocusPlugin()];
    },
  });

const typewriterFocusPlugin = (): Plugin<TypewriterState> =>
  new Plugin<TypewriterState>({
    key: PLUGIN_KEY,
    state: {
      init: () => ({ enabled: false, activeId: null }),
      apply(tr, prev) {
        const metaEnabled = tr.getMeta(TYPEWRITER_FOCUS_META_KEY) as boolean | undefined;
        const activeId =
          tr.selectionSet || tr.docChanged ? blockIdAt(tr.selection.$from) : prev.activeId;
        return {
          enabled: metaEnabled !== undefined ? metaEnabled : prev.enabled,
          activeId,
        };
      },
    },
    props: {
      decorations(state) {
        const s = PLUGIN_KEY.getState(state);
        if (!s?.enabled || !s.activeId) return DecorationSet.empty;
        return buildDecorations(state.doc, s.activeId);
      },
    },
  });

const blockIdAt = ($pos: ResolvedPos): string | null => {
  for (let depth = $pos.depth; depth >= 0; depth--) {
    const node = $pos.node(depth);
    const id = node.attrs?.[BLOCK_ID_ATTR] as string | undefined;
    if (id) return id;
  }
  return null;
};

const buildDecorations = (doc: PMNode, activeId: string): DecorationSet => {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!BLOCK_ID_TARGET_TYPES.has(node.type.name)) return true;
    const id = node.attrs[BLOCK_ID_ATTR] as string | null;
    if (!id || id === activeId) return true;
    decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: 'mc-typewriter-dim' }));
    return true;
  });
  return DecorationSet.create(doc, decorations);
};
