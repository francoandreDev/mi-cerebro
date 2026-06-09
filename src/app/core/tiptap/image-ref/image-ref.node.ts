import { Node, mergeAttributes } from '@tiptap/core';

import type { ImageReaderService } from '@core/images/image-reader.service';

export const IMAGE_REF_NAME = 'imageRef';

interface ImageRefAttrs {
  galleryId: string | null;
  imageId: string | null;
  alt: string | null;
}

interface DataElement extends Element {
  dataset: DOMStringMap;
}

// why: persisted inline node that points at an image stored in a gallery.
//      Rendered with a NodeView so we can lazily load the thumb blob and
//      revoke the URL on destroy. The persisted shape is plain
//      `<span data-image-ref data-gallery-id data-image-id data-alt>` so
//      copy/paste and search keep working on plain HTML.
export const createImageRefNode = (reader: ImageReaderService) =>
  Node.create<ImageRefAttrs>({
    name: IMAGE_REF_NAME,
    group: 'inline',
    inline: true,
    atom: true,
    draggable: true,
    selectable: true,

    addAttributes() {
      return {
        galleryId: {
          default: null,
          parseHTML: (el) => (el as DataElement).dataset['galleryId'] ?? null,
          renderHTML: (attrs) =>
            attrs['galleryId'] ? { 'data-gallery-id': attrs['galleryId'] } : {},
        },
        imageId: {
          default: null,
          parseHTML: (el) => (el as DataElement).dataset['imageId'] ?? null,
          renderHTML: (attrs) => (attrs['imageId'] ? { 'data-image-id': attrs['imageId'] } : {}),
        },
        alt: {
          default: null,
          parseHTML: (el) => (el as DataElement).dataset['alt'] ?? null,
          renderHTML: (attrs) => (attrs['alt'] ? { 'data-alt': attrs['alt'] } : {}),
        },
      };
    },

    parseHTML() {
      return [{ tag: 'span[data-image-ref]' }];
    },

    renderHTML({ HTMLAttributes }) {
      return ['span', mergeAttributes({ 'data-image-ref': '' }, HTMLAttributes)];
    },

    addNodeView() {
      return ({ node }) => {
        const dom = document.createElement('span');
        dom.classList.add('mc-image-ref');
        dom.setAttribute('data-image-ref', '');

        const img = document.createElement('img');
        img.alt = (node.attrs['alt'] as string | null) ?? '';
        img.draggable = false;
        dom.appendChild(img);

        let url: string | null = null;
        const galleryId = node.attrs['galleryId'] as string | null;
        const imageId = node.attrs['imageId'] as string | null;
        if (galleryId && imageId) {
          void reader
            .readThumbBlob(galleryId, imageId)
            .then((blob) => {
              if (!blob) return reader.readOriginalBlob(galleryId, imageId);
              return blob;
            })
            .then((blob) => {
              url = URL.createObjectURL(blob);
              img.src = url;
            })
            .catch(() => {
              dom.classList.add('mc-image-ref--missing');
              img.alt = '⚠';
            });
        }

        return {
          dom,
          destroy: () => {
            if (url) URL.revokeObjectURL(url);
          },
        };
      };
    },
  });
