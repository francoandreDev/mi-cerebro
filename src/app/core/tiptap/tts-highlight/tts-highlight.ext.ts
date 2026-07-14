// why: la lectura en voz alta (TtsService) necesita resaltar el bloque que
//      se está leyendo. Igual que bookmark-pin/draft-decorations, una clase
//      aplicada a mano vía DOM plano (classList.add) desaparece en la
//      próxima transacción de ProseMirror — el reconciliador reescribe el
//      subárbol del nodo desde su propio modelo. Una node-decoration es la
//      única forma que sobrevive a esos re-renders.

import { Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

import { BLOCK_ID_ATTR } from '../block-id/block-id.types';

export const TTS_HIGHLIGHT_EXTENSION_NAME = 'mcTtsHighlight';
export const TTS_HIGHLIGHT_META_KEY = 'mc-tts-highlight.set';

const PLUGIN_KEY = new PluginKey<DecorationSet>('mc-tts-highlight');

export const createTtsHighlightExtension = () =>
  Extension.create({
    name: TTS_HIGHLIGHT_EXTENSION_NAME,
    addProseMirrorPlugins() {
      return [ttsHighlightPlugin()];
    },
  });

const ttsHighlightPlugin = (): Plugin<DecorationSet> =>
  new Plugin<DecorationSet>({
    key: PLUGIN_KEY,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, prev) {
        const next = tr.getMeta(TTS_HIGHLIGHT_META_KEY) as string | null | undefined;
        if (next !== undefined) return buildDecorations(tr.doc, next);
        return tr.docChanged ? prev.map(tr.mapping, tr.doc) : prev;
      },
    },
    props: {
      decorations(state) {
        return this.getState(state) ?? DecorationSet.empty;
      },
    },
  });

const buildDecorations = (doc: PMNode, blockId: string | null): DecorationSet => {
  if (!blockId) return DecorationSet.empty;
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.attrs[BLOCK_ID_ATTR] !== blockId) return true;
    decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: 'mc-tts-active' }));
    return false;
  });
  return DecorationSet.create(doc, decorations);
};
