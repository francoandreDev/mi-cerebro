import type { JSONContent } from '@tiptap/core';

import { BLOCK_ID_ATTR, BLOCK_ID_TARGET_TYPES } from './block-id.types';

type Gen = () => string;

// Pure walker used by entity migrations to backfill ids in old documents.
// Idempotent: existing valid ids are preserved; missing or duplicate ids
// are replaced with a fresh UUID. Non-doc shapes are returned untouched
// so the same step can be plugged into kinds whose payload sometimes
// carries a body and sometimes does not (books vs chapters).
export function injectBlockIds(doc: JSONContent, gen: Gen = crypto.randomUUID): JSONContent {
  if (!doc || typeof doc !== 'object' || doc.type !== 'doc') return doc;
  return walk(doc, new Set<string>(), gen);
}

function walk(node: JSONContent, seen: Set<string>, gen: Gen): JSONContent {
  const attrs = ensureBlockId(node, seen, gen);
  if (!node.content || node.content.length === 0) {
    return attrs === node.attrs ? node : { ...node, attrs };
  }
  const nextContent = node.content.map((child) => walk(child, seen, gen));
  const contentChanged = nextContent.some((c, i) => c !== node.content?.[i]);
  if (attrs === node.attrs && !contentChanged) return node;
  return { ...node, ...(attrs === node.attrs ? {} : { attrs }), content: nextContent };
}

function ensureBlockId(
  node: JSONContent,
  seen: Set<string>,
  gen: Gen,
): JSONContent['attrs'] | undefined {
  if (!node.type || !BLOCK_ID_TARGET_TYPES.has(node.type)) return node.attrs;
  const existing = node.attrs?.[BLOCK_ID_ATTR];
  const reusable = typeof existing === 'string' && existing.length > 0 && !seen.has(existing);
  const id = reusable ? (existing as string) : gen();
  seen.add(id);
  return { ...(node.attrs ?? {}), [BLOCK_ID_ATTR]: id };
}
