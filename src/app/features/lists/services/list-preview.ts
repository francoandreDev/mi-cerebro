import type { JSONContent } from '@tiptap/core';

import { extractPlainText } from '@core/search/tiptap-text';

const PREVIEW_ITEM_LIMIT = 4;
const PREVIEW_ITEM_MAX_CHARS = 120;

export interface ListPreview {
  readonly items: readonly string[];
  readonly itemCount: number;
}

export const buildListPreview = (body: JSONContent | undefined): ListPreview => {
  if (!body) return { items: [], itemCount: 0 };
  const items: string[] = [];
  let itemCount = 0;
  for (const block of body.content ?? []) {
    if (block.type !== 'bulletList' && block.type !== 'orderedList') continue;
    for (const li of block.content ?? []) {
      if (li.type !== 'listItem') continue;
      const text = clamp(extractPlainText(li));
      if (text === '') continue;
      itemCount++;
      if (items.length < PREVIEW_ITEM_LIMIT) items.push(text);
    }
  }
  return { items, itemCount };
};

const clamp = (text: string): string =>
  text.length > PREVIEW_ITEM_MAX_CHARS
    ? `${text.slice(0, PREVIEW_ITEM_MAX_CHARS - 1).trimEnd()}…`
    : text;
