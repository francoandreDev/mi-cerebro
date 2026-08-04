import type { JSONContent } from '@tiptap/core';

export function jsonContentToText(doc: JSONContent): string {
  if (!doc) return '';
  const parts: string[] = [];
  const walk = (n: JSONContent): void => {
    if (typeof n.text === 'string') parts.push(n.text);
    for (const c of n.content ?? []) walk(c);
  };
  walk(doc);
  return parts.join(' ').trim();
}
