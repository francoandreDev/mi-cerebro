import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';
import type { Node as PMNode } from '@tiptap/pm/model';

import { BLOCK_ID_ATTR, BLOCK_ID_TARGET_TYPES } from './block-id.types';

const PLUGIN_KEY = new PluginKey('mc-block-id');

interface DataElement extends Element {
  dataset: DOMStringMap;
}

interface Fixup {
  readonly pos: number;
  readonly node: PMNode;
  readonly nextId: string;
}

export const BLOCK_ID_EXTENSION_NAME = 'mcBlockId';

// why: live block-id maintenance for the editor. addGlobalAttributes
//      teaches StarterKit's nodes to round-trip `data-block-id` to/from
//      JSON; the plugin patches the doc on every transaction so newly
//      created or duplicated blocks always end up with a fresh UUID.
export const createBlockIdExtension = (gen: () => string = crypto.randomUUID) =>
  Extension.create({
    name: BLOCK_ID_EXTENSION_NAME,

    addGlobalAttributes() {
      return [
        {
          types: [...BLOCK_ID_TARGET_TYPES],
          attributes: {
            [BLOCK_ID_ATTR]: {
              default: null,
              // why: keepOnSplit:false ensures Enter on a paragraph yields
              //      a new node with no id, so the appendTransaction below
              //      assigns one. Without this, the split-off paragraph
              //      would copy the original id and we'd have duplicates.
              keepOnSplit: false,
              parseHTML: (el) => (el as DataElement).dataset['blockId'] ?? null,
              renderHTML: (attrs) =>
                attrs[BLOCK_ID_ATTR] ? { 'data-block-id': attrs[BLOCK_ID_ATTR] } : {},
            },
          },
        },
      ];
    },

    addProseMirrorPlugins() {
      return [blockIdPlugin(gen)];
    },
  });

const blockIdPlugin = (gen: () => string): Plugin =>
  new Plugin({
    key: PLUGIN_KEY,
    appendTransaction: (transactions, _oldState, newState) => {
      if (!transactions.some((t) => t.docChanged)) return null;
      const fixups = collectFixups(newState, gen);
      return fixups.length === 0 ? null : applyFixups(newState, fixups);
    },
  });

const collectFixups = (state: EditorState, gen: () => string): Fixup[] => {
  const fixups: Fixup[] = [];
  const seen = new Set<string>();
  state.doc.descendants((node, pos) => {
    if (!BLOCK_ID_TARGET_TYPES.has(node.type.name)) return true;
    const id = node.attrs[BLOCK_ID_ATTR] as string | null;
    if (typeof id === 'string' && id.length > 0 && !seen.has(id)) {
      seen.add(id);
      return true;
    }
    const nextId = gen();
    seen.add(nextId);
    fixups.push({ pos, node, nextId });
    return true;
  });
  return fixups;
};

const applyFixups = (state: EditorState, fixups: readonly Fixup[]): Transaction => {
  const tr = state.tr;
  for (const f of fixups) {
    tr.setNodeMarkup(f.pos, undefined, { ...f.node.attrs, [BLOCK_ID_ATTR]: f.nextId });
  }
  // why: not part of an undo step — a fresh id assigned during a paste
  //      should stay after undo of that paste (the node is gone anyway),
  //      and we don't want Ctrl+Z to randomly null out ids the user never
  //      sees.
  tr.setMeta('addToHistory', false);
  return tr;
};
