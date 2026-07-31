import { Node, mergeAttributes } from '@tiptap/core';

import { entityKindIcon } from '@shared/entity-cards/entity-kind-icon';
import { ICON_DATA } from '@shared/icon/icons.data';

export const ENTITY_REF_NAME = 'entityRef';

interface EntityRefAttrs {
  kind: string | null;
  entityId: string | null;
  label: string | null;
}

interface DataElement extends Element {
  dataset: DOMStringMap;
}

export interface EntityRefOpenPayload {
  readonly kind: string;
  readonly entityId: string;
  readonly label: string;
}

// why: nodo inline persistido que apunta a otra entidad (§10bis). Igual que
//      image-ref, se persiste como <span data-entity-ref data-kind
//      data-entity-id data-label> plano para que copy/paste y búsqueda de
//      texto sigan andando. A diferencia de image-ref no hace fetch async: el
//      label queda congelado al insertar (mismo criterio que contextSnippet
//      en Relation, ver features.md §10bis) — el NodeView renderiza síncrono,
//      sin estado de carga/error.
export const createEntityRefNode = (onOpen: (payload: EntityRefOpenPayload) => void) =>
  Node.create<EntityRefAttrs>({
    name: ENTITY_REF_NAME,
    group: 'inline',
    inline: true,
    atom: true,
    draggable: false,
    selectable: true,

    addAttributes() {
      return {
        kind: {
          default: null,
          parseHTML: (el) => (el as DataElement).dataset['kind'] ?? null,
          renderHTML: (attrs) => (attrs['kind'] ? { 'data-kind': attrs['kind'] } : {}),
        },
        entityId: {
          default: null,
          parseHTML: (el) => (el as DataElement).dataset['entityId'] ?? null,
          renderHTML: (attrs) => (attrs['entityId'] ? { 'data-entity-id': attrs['entityId'] } : {}),
        },
        label: {
          default: null,
          parseHTML: (el) => (el as DataElement).dataset['label'] ?? null,
          renderHTML: (attrs) => (attrs['label'] ? { 'data-label': attrs['label'] } : {}),
        },
      };
    },

    parseHTML() {
      return [{ tag: 'span[data-entity-ref]' }];
    },

    renderHTML({ HTMLAttributes }) {
      return ['span', mergeAttributes({ 'data-entity-ref': '' }, HTMLAttributes)];
    },

    addNodeView() {
      return ({ node }) => {
        const kind = node.attrs['kind'] as string | null;
        const entityId = node.attrs['entityId'] as string | null;
        const label = (node.attrs['label'] as string | null) ?? '';

        const dom = document.createElement('span');
        dom.classList.add('mc-entity-ref');
        dom.setAttribute('data-entity-ref', '');
        dom.setAttribute('role', 'button');
        dom.setAttribute('tabindex', '0');
        dom.setAttribute('aria-label', label);

        const icon = document.createElement('span');
        icon.classList.add('mc-entity-ref-icon');
        // why: ICON_DATA sólo tiene el <path> interno (ver icons.data.ts) —
        //      IconComponent lo envuelve en <svg> vía Angular; acá no hay
        //      Angular, así que se arma la misma envoltura a mano.
        icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" width="100%" height="100%">${ICON_DATA[entityKindIcon(kind ?? '')]}</svg>`;
        dom.appendChild(icon);

        const text = document.createElement('span');
        text.classList.add('mc-entity-ref-label');
        text.textContent = label;
        dom.appendChild(text);

        const open = (): void => {
          if (kind && entityId) onOpen({ kind, entityId, label });
        };
        dom.addEventListener('click', open);
        dom.addEventListener('keydown', (event: KeyboardEvent) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          open();
        });

        return { dom };
      };
    },
  });
