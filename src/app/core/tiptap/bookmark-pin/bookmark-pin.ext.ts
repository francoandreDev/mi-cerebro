// why: marcador de párrafo — como comment-clouds.ext.ts, un widget de
//      ProseMirror es la única forma correcta de inyectar DOM dentro del
//      contenido que el editor gestiona. Un <button> agregado a mano vía
//      DOM plano (appendChild) desaparece en la próxima transacción: el
//      reconciliador de ProseMirror reescribe el subárbol del nodo desde su
//      propio modelo y descarta cualquier hijo que no reconozca.
//
// why: el pin sigue la SELECCIÓN (dónde está el cursor/rango elegido), no
//      el hover del mouse. Un pin activado por hover queda posicionado en
//      el margen, fuera del área de hover del párrafo — mover el mouse
//      HACIA el ícono para clickearlo cancela el hover antes de llegar. La
//      selección, en cambio, no se mueve sola cuando el mouse viaja hacia
//      el botón.

import { Extension } from '@tiptap/core';
import type { Node as PMNode, ResolvedPos } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

import { BLOCK_ID_ATTR, BLOCK_ID_TARGET_TYPES } from '../block-id/block-id.types';

export const BOOKMARK_PIN_EXTENSION_NAME = 'mcBookmarkPin';
export const BOOKMARK_PIN_META_KEY = 'mc-bookmark-pin.set';

interface PinState {
  readonly bookmarkedId: string | null;
  readonly selectedId: string | null;
}

const PLUGIN_KEY = new PluginKey<PinState>('mc-bookmark-pin');

export interface BookmarkPinHandlers {
  // why: mc-editor es compartido (notas, tareas, etc.) — el pin sólo debe
  //      activarse para los consumidores que lo piden explícitamente (hoy
  //      sólo capítulos de libro), no en cualquier editor de la app.
  readonly isBookmarkable: () => boolean;
  readonly onToggle: (blockId: string) => void;
  readonly pinAriaLabel: () => string;
  readonly markerAriaLabel: () => string;
}

export const createBookmarkPinExtension = (handlers: BookmarkPinHandlers) =>
  Extension.create({
    name: BOOKMARK_PIN_EXTENSION_NAME,
    addProseMirrorPlugins() {
      return [bookmarkPinPlugin(handlers)];
    },
  });

const bookmarkPinPlugin = (handlers: BookmarkPinHandlers): Plugin<PinState> =>
  new Plugin<PinState>({
    key: PLUGIN_KEY,
    state: {
      init: () => ({ bookmarkedId: null, selectedId: null }),
      apply(tr, prev) {
        const nextBookmark = tr.getMeta(BOOKMARK_PIN_META_KEY) as string | null | undefined;
        const selectedId =
          tr.selectionSet || tr.docChanged ? blockIdAt(tr.selection.$from) : prev.selectedId;
        return {
          bookmarkedId: nextBookmark !== undefined ? nextBookmark : prev.bookmarkedId,
          selectedId,
        };
      },
    },
    props: {
      decorations(state) {
        if (!handlers.isBookmarkable()) return DecorationSet.empty;
        const pinState = PLUGIN_KEY.getState(state);
        if (!pinState || (!pinState.bookmarkedId && !pinState.selectedId))
          return DecorationSet.empty;
        return buildDecorations(state.doc, pinState, handlers);
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

const buildDecorations = (
  doc: PMNode,
  pinState: PinState,
  handlers: BookmarkPinHandlers,
): DecorationSet => {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!BLOCK_ID_TARGET_TYPES.has(node.type.name)) return true;
    const id = node.attrs[BLOCK_ID_ATTR] as string | null;
    if (!id) return true;
    if (id === pinState.bookmarkedId) {
      decorations.push(pinDecoration(pos + 1, id, true, handlers));
    } else if (id === pinState.selectedId) {
      decorations.push(pinDecoration(pos + 1, id, false, handlers));
    }
    return true;
  });
  return DecorationSet.create(doc, decorations);
};

// why: side -1 + ignoreSelection, mismo criterio que comment-clouds — el
//      widget no debe robar el caret ni contar como destino de selección.
const pinDecoration = (
  pos: number,
  blockId: string,
  active: boolean,
  handlers: BookmarkPinHandlers,
): Decoration =>
  Decoration.widget(pos, () => buildPinButton(blockId, active, handlers), {
    side: -1,
    key: `bookmark-pin-${blockId}-${active ? 'on' : 'off'}`,
    ignoreSelection: true,
  });

const buildPinButton = (
  blockId: string,
  active: boolean,
  handlers: BookmarkPinHandlers,
): HTMLElement => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = active ? 'mc-para-pin active' : 'mc-para-pin';
  btn.setAttribute('data-block-id', blockId);
  btn.setAttribute('contenteditable', 'false');
  const label = active ? handlers.markerAriaLabel() : handlers.pinAriaLabel();
  btn.setAttribute('aria-label', label);
  btn.title = label;
  btn.innerHTML = PARA_PIN_SVG;
  btn.addEventListener('mousedown', (event) => event.stopPropagation());
  btn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    handlers.onToggle(blockId);
  });
  return btn;
};

const PARA_PIN_SVG =
  '<svg viewBox="0 0 256 256" width="14" height="14" fill="currentColor"><path d="M184,32H72A16,16,0,0,0,56,48V224a8,8,0,0,0,12.24,6.78L128,193.43l59.77,37.35A8,8,0,0,0,200,224V48A16,16,0,0,0,184,32Zm0,16V161.57l-51.77-32.35a8,8,0,0,0-8.48,0L72,161.56V48ZM132.23,177.22a8,8,0,0,0-8.48,0L72,209.57V180.43l56-35,56,35v29.14Z"/></svg>';
