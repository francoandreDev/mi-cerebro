// Helpers for diff.service: TipTap doc → plain text plus the field
// categorization that turns a raw entity JSON delta into a
// structured view (title / body / tags / user fields / system).

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

export const ENTITY_PREFIXES = [
  'notes/',
  'tasks/',
  'goals/',
  'lists/',
  'writings/',
  'books/',
  'images/',
  'files/',
  'reminders/',
] as const;

export function isEntityPath(filepath: string): boolean {
  if (!filepath.endsWith('.json')) return false;
  return ENTITY_PREFIXES.some((p) => filepath.startsWith(p));
}

const SYSTEM_KEYS = new Set(['id', 'createdAt', 'updatedAt', 'schemaVersion']);
const HANDLED_SEPARATELY = new Set(['title', 'body', 'tags']);

export type FieldChangeStatus = 'added' | 'removed' | 'modified' | 'unchanged';

export interface FieldDiff {
  readonly key: string;
  readonly status: FieldChangeStatus;
  readonly before: string | null;
  readonly after: string | null;
}

export interface FieldCategories {
  readonly user: readonly FieldDiff[];
  readonly system: readonly FieldDiff[];
}

export function categorizeFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): FieldCategories {
  const keys = collectChangedKeys(before, after);
  const user: FieldDiff[] = [];
  const system: FieldDiff[] = [];
  for (const key of keys) {
    const diff = fieldDiffFor(key, before?.[key], after?.[key]);
    if (diff.status === 'unchanged') continue;
    if (SYSTEM_KEYS.has(key)) system.push(diff);
    else user.push(diff);
  }
  return { user, system };
}

function collectChangedKeys(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): readonly string[] {
  const keys = new Set<string>();
  for (const k of Object.keys(before ?? {})) if (!HANDLED_SEPARATELY.has(k)) keys.add(k);
  for (const k of Object.keys(after ?? {})) if (!HANDLED_SEPARATELY.has(k)) keys.add(k);
  return [...keys];
}

function fieldDiffFor(key: string, before: unknown, after: unknown): FieldDiff {
  const b = serializeFieldValue(before);
  const a = serializeFieldValue(after);
  let status: FieldChangeStatus = 'unchanged';
  if (b === null && a !== null) status = 'added';
  else if (a === null && b !== null) status = 'removed';
  else if (b !== a) status = 'modified';
  return { key, status, before: b, after: a };
}

function serializeFieldValue(v: unknown): string | null {
  if (v === undefined) return null;
  if (v === null) return 'null';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

export interface TagsDelta {
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly unchanged: readonly string[];
}

export function diffTagArrays(
  before: readonly string[] | null,
  after: readonly string[] | null,
): TagsDelta {
  const bSet = new Set(before ?? []);
  const aSet = new Set(after ?? []);
  return {
    added: [...aSet].filter((x) => !bSet.has(x)).sort(),
    removed: [...bSet].filter((x) => !aSet.has(x)).sort(),
    unchanged: [...bSet].filter((x) => aSet.has(x)).sort(),
  };
}

export function asTagArray(value: unknown): readonly string[] | null {
  if (!Array.isArray(value)) return null;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') return null;
    out.push(item);
  }
  return out;
}

export function parseEntityJson(blob: Uint8Array | null): Record<string, unknown> | null {
  if (!blob) return null;
  try {
    const v = JSON.parse(blobToText(blob)) as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export interface InlineTitleDiff {
  readonly status: FieldChangeStatus;
  readonly before: string | null;
  readonly after: string | null;
}

export function titleDiffOf(before: unknown, after: unknown): InlineTitleDiff {
  const b = typeof before === 'string' ? before : null;
  const a = typeof after === 'string' ? after : null;
  return { status: statusOf(b, a), before: b, after: a };
}

function statusOf(before: string | null, after: string | null): FieldChangeStatus {
  if (before === after) return 'unchanged';
  if (before === null) return 'added';
  if (after === null) return 'removed';
  return 'modified';
}

export interface InlineDiffChunk {
  readonly kind: 'context' | 'add' | 'remove';
  readonly value: string;
}

export function bodyDiffOf(
  before: unknown,
  after: unknown,
  diffPair: (a: string, b: string) => readonly InlineDiffChunk[],
): readonly InlineDiffChunk[] | null {
  const beforeText = before ? tipTapToText(before).trimEnd() : null;
  const afterText = after ? tipTapToText(after).trimEnd() : null;
  if (beforeText === null && afterText === null) return null;
  if (beforeText === afterText) return [];
  if (beforeText === null) return [{ kind: 'add', value: afterText! + '\n' }];
  if (afterText === null) return [{ kind: 'remove', value: beforeText + '\n' }];
  return diffPair(beforeText, afterText);
}
