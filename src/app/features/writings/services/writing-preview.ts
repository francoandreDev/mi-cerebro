import type { JSONContent } from '@tiptap/core';

import { extractPlainText } from '@core/search/tiptap-text';

const PREVIEW_MAX_CHARS = 240;

export interface WritingPreview {
  readonly preview: string;
  readonly wordCount: number;
}

export const buildWritingPreview = (body: JSONContent | undefined): WritingPreview => {
  if (!body) return { preview: '', wordCount: 0 };
  const text = extractPlainText(body).trim();
  if (text === '') return { preview: '', wordCount: 0 };
  const wordCount = text.split(/\s+/).length;
  const preview =
    text.length > PREVIEW_MAX_CHARS ? `${text.slice(0, PREVIEW_MAX_CHARS - 1).trimEnd()}…` : text;
  return { preview, wordCount };
};
