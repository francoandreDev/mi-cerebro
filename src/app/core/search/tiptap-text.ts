import type { JSONContent } from '@tiptap/core';

// Why: indexing needs flat text, not a ProseMirror tree. We walk the document
//      collecting every `text` node with a space between blocks so adjacent
//      paragraphs don't merge into a single token.
export const extractPlainText = (doc: JSONContent | undefined): string => {
  if (!doc) return '';
  const parts: string[] = [];
  const walk = (node: JSONContent): void => {
    if (typeof node.text === 'string') parts.push(node.text);
    for (const child of node.content ?? []) walk(child);
    if (node.type && BLOCK_TYPES.has(node.type)) parts.push(' ');
  };
  walk(doc);
  return parts.join('').replace(/\s+/g, ' ').trim();
};

const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'citation',
  'citationAttribution',
  'codeBlock',
  'bulletList',
  'orderedList',
  'listItem',
  'horizontalRule',
]);
