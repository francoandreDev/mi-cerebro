import type { JSONContent } from '@tiptap/core';

import type { ImageReaderService } from '@core/images/image-reader.service';
import {
  tiptapToMarkdown,
  type MarkdownImageResolver,
} from '@core/tiptap/markdown/tiptap-to-markdown';
import { toSlug } from '@shared/utils/slug';

import type { Book, Chapter } from '../models/book.types';

export const chapterToMarkdown = (
  chapter: Chapter,
  untitled: string,
  resolveImage?: MarkdownImageResolver,
): string =>
  `# ${chapter.title || untitled}\n\n${tiptapToMarkdown(chapter.body, 0, resolveImage)}`.trim();

export const bookToMarkdown = (
  book: Book,
  chapters: readonly Chapter[],
  untitled: string,
  resolveImage?: MarkdownImageResolver,
): string => {
  const parts = [`# ${book.title || untitled}`];
  for (const ch of chapters) {
    parts.push(`## ${ch.title || untitled}`, tiptapToMarkdown(ch.body, 1, resolveImage));
  }
  return parts.filter((p) => p !== '').join('\n\n');
};

export const markdownFilename = (title: string, fallback: string): string =>
  `${toSlug(title, fallback)}.md`;

// why: embeds referenced images as `data:` URIs so the exported .md stays a
//      single portable file — imageRef points at an app-internal gallery
//      (galleryId/imageId), not a standalone file, so there's no path we
//      could link to instead. Reads the thumb first (same fallback order the
//      live editor's NodeView uses, see image-ref.node.ts) to keep the
//      embedded file small; images that fail to resolve (gallery/image
//      deleted since the chapter was written) are silently skipped — the
//      export falls back to `![alt]()`, same as if there were no images.
export async function buildImageResolver(
  reader: ImageReaderService,
  docs: readonly JSONContent[],
): Promise<MarkdownImageResolver> {
  const refs = new Map<string, { galleryId: string; imageId: string }>();
  for (const doc of docs) collectImageRefs(doc, refs);

  const resolved = await Promise.all(
    Array.from(refs.entries()).map(async ([key, ref]) => {
      const dataUri = await readImageDataUri(reader, ref.galleryId, ref.imageId);
      return [key, dataUri] as const;
    }),
  );
  const dataUris = new Map(
    resolved.filter((entry): entry is [string, string] => entry[1] !== null),
  );
  return (galleryId, imageId) =>
    galleryId && imageId ? dataUris.get(`${galleryId}:${imageId}`) : undefined;
}

const collectImageRefs = (
  node: JSONContent,
  out: Map<string, { galleryId: string; imageId: string }>,
): void => {
  if (node.type === 'imageRef') {
    const galleryId = node.attrs?.['galleryId'] as string | null;
    const imageId = node.attrs?.['imageId'] as string | null;
    if (galleryId && imageId) out.set(`${galleryId}:${imageId}`, { galleryId, imageId });
  }
  for (const child of node.content ?? []) collectImageRefs(child, out);
};

const readImageDataUri = async (
  reader: ImageReaderService,
  galleryId: string,
  imageId: string,
): Promise<string | null> => {
  try {
    const blob =
      (await reader.readThumbBlob(galleryId, imageId)) ??
      (await reader.readOriginalBlob(galleryId, imageId));
    const buffer = await blob.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);
    return `data:${blob.type || 'application/octet-stream'};base64,${base64}`;
  } catch {
    return null;
  }
};

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
  return btoa(binary);
};
