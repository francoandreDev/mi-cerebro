// Helpers for diff.service: TipTap doc → plain text and a JSON
// rewriter that swaps any embedded TipTap doc for its extracted
// text so the line-diff of the entity reads like prose instead
// of nested JSON noise.

const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'taskList',
  'taskItem',
]);

export function tipTapToText(doc: unknown): string {
  if (!doc || typeof doc !== 'object') return '';
  const node = doc as { type?: string; text?: string; content?: unknown[] };
  if (node.type === 'text' && typeof node.text === 'string') return node.text;
  const inner = (node.content ?? []).map((c) => tipTapToText(c)).join('');
  return BLOCK_TYPES.has(node.type ?? '') ? `${inner}\n` : inner;
}

// Look for fields that look like a TipTap doc (type: 'doc') anywhere
// in the entity JSON, and replace them with their extracted text.
// Other fields stay as-is.
export function rewriteJsonForDiff(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(rewriteJsonForDiff);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (isTipTapDoc(obj)) return tipTapToText(obj).trimEnd();
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj)) out[k] = rewriteJsonForDiff(obj[k]);
    return out;
  }
  return value;
}

function isTipTapDoc(obj: Record<string, unknown>): boolean {
  return obj['type'] === 'doc' && Array.isArray(obj['content']);
}

const DECODER = new TextDecoder();

export function blobToText(blob: Uint8Array | null): string {
  if (!blob) return '';
  return DECODER.decode(blob);
}

export function isLikelyBinary(blob: Uint8Array | null): boolean {
  if (!blob) return false;
  // why: a quick zero-byte sniff. Real content (JSON, markdown) won't
  //      contain NUL; binary formats almost always do in the first 512.
  const slice = blob.subarray(0, Math.min(blob.length, 512));
  for (const byte of slice) if (byte === 0) return true;
  return false;
}
