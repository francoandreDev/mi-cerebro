// Helpers for diff.service: TipTap doc → plain text plus the field
// categorization that turns a raw entity JSON delta into a
// structured view (title / body / tags / user fields / system).

const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'citation',
  'citationAttribution',
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

const HANDLED_SEPARATELY = new Set(['title', 'body', 'tags']);

// why: campos que la app mantiene mecánicamente (ids, timestamps, índices
//      de reorden, valores derivados, punteros del scheduler). El usuario
//      está mirando SU historial personal, no un log técnico; verlos
//      cambiar en cada commit es ruido puro. Se filtran del diff pipeline
//      sin tocar la persistencia — el JSON en disco los conserva porque
//      la app los necesita en runtime.
const UNIVERSAL_SYSTEM_KEYS: readonly string[] = [
  'id',
  'createdAt',
  'updatedAt',
  'schemaVersion',
  'position',
];

type EntityFamily =
  | 'notes'
  | 'tasks'
  | 'goals'
  | 'lists'
  | 'writings'
  | 'books'
  | 'chapters'
  | 'images'
  | 'files'
  | 'reminders';

const SYSTEM_KEYS_BY_FAMILY: Record<EntityFamily, readonly string[]> = {
  notes: [],
  tasks: ['enteredHoyAt'],
  goals: ['progress', 'wallCenter'],
  lists: [],
  writings: [],
  books: [],
  chapters: ['bookId', 'pageCount'],
  images: [],
  files: [],
  reminders: ['nextPingAt'],
};

function familyOfEntityPath(filepath: string): EntityFamily | null {
  if (filepath.startsWith('books/')) {
    return /\/chapters\/[^/]+\.json$/.test(filepath) ? 'chapters' : 'books';
  }
  if (filepath.startsWith('notes/')) return 'notes';
  if (filepath.startsWith('tasks/')) return 'tasks';
  if (filepath.startsWith('goals/')) return 'goals';
  if (filepath.startsWith('lists/')) return 'lists';
  if (filepath.startsWith('writings/')) return 'writings';
  if (filepath.startsWith('images/')) return 'images';
  if (filepath.startsWith('files/')) return 'files';
  if (filepath.startsWith('reminders/')) return 'reminders';
  return null;
}

function systemKeysFor(filepath: string): ReadonlySet<string> {
  const family = familyOfEntityPath(filepath);
  const extras = family ? SYSTEM_KEYS_BY_FAMILY[family] : [];
  return new Set([...UNIVERSAL_SYSTEM_KEYS, ...extras]);
}

export type FieldChangeStatus = 'added' | 'removed' | 'modified' | 'unchanged';

export interface FieldDiff {
  readonly key: string;
  readonly status: FieldChangeStatus;
  readonly before: string | null;
  readonly after: string | null;
}

export function computeUserFields(
  filepath: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): readonly FieldDiff[] {
  const systemKeys = systemKeysFor(filepath);
  const keys = collectChangedKeys(before, after);
  const out: FieldDiff[] = [];
  for (const key of keys) {
    if (systemKeys.has(key)) continue;
    const diff = fieldDiffFor(key, before?.[key], after?.[key]);
    if (diff.status === 'unchanged') continue;
    out.push(diff);
  }
  return out;
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

// why: system JSON files (variants.json, config.json, comments/*, drafts/*)
//      no son entidades de usuario y antes caían al diff de texto crudo. Para
//      no obligar al usuario a leer JSON, los aplanamos a paths punto-notados
//      y los renderizamos como tabla "antes → después" (igual que user fields).
export function flattenJson(value: unknown, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  walkFlatten(value, prefix, out);
  return out;
}

function walkFlatten(value: unknown, prefix: string, out: Map<string, string>): void {
  const label = prefix === '' ? '(raíz)' : prefix;
  if (value === undefined) return;
  if (value === null || typeof value !== 'object') {
    out.set(label, serializeLeaf(value));
    return;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      out.set(label, '[]');
      return;
    }
    value.forEach((item, i) => walkFlatten(item, `${prefix}[${i}]`, out));
    return;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) {
    out.set(label, '{}');
    return;
  }
  for (const k of keys) walkFlatten(obj[k], prefix === '' ? k : `${prefix}.${k}`, out);
}

function serializeLeaf(v: unknown): string {
  if (v === null) return 'null';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

export function diffFlatJson(before: unknown, after: unknown): readonly FieldDiff[] {
  const a = flattenJson(before);
  const b = flattenJson(after);
  const seen = new Set<string>();
  const order: string[] = [];
  for (const k of b.keys()) {
    if (!seen.has(k)) {
      seen.add(k);
      order.push(k);
    }
  }
  for (const k of a.keys()) {
    if (!seen.has(k)) {
      seen.add(k);
      order.push(k);
    }
  }
  const out: FieldDiff[] = [];
  for (const key of order) {
    const hasBefore = a.has(key);
    const hasAfter = b.has(key);
    const bv = hasBefore ? (a.get(key) ?? null) : null;
    const av = hasAfter ? (b.get(key) ?? null) : null;
    let status: FieldChangeStatus = 'unchanged';
    if (!hasBefore && hasAfter) status = 'added';
    else if (hasBefore && !hasAfter) status = 'removed';
    else if (bv !== av) status = 'modified';
    if (status === 'unchanged') continue;
    out.push({ key, status, before: bv, after: av });
  }
  return out;
}

// why: drafts/<id>.json y comments/<id>.json llevan structuras conocidas
//      (marks[] y comments[]). En lugar de aplanar el JSON, mostramos cada
//      ítem como un cambio de alto nivel: para drafts es "antes → después"
//      en texto plano; para comments es el body del comentario en texto.
export type AnchorChangeStatus = 'added' | 'removed' | 'modified';

export interface AnchorChange {
  readonly id: string;
  readonly status: AnchorChangeStatus;
  readonly anchorType: string;
  readonly anchor: string;
  readonly before: string | null;
  readonly after: string | null;
}

export type AnchorMode = 'drafts' | 'comments';

const ANCHOR_LIST_KEY: Record<AnchorMode, string> = {
  drafts: 'marks',
  comments: 'comments',
};

export function diffAnchoredItems(
  before: unknown,
  after: unknown,
  mode: AnchorMode,
): readonly AnchorChange[] {
  const key = ANCHOR_LIST_KEY[mode];
  const bMap = mapById(extractList(before, key));
  const aMap = mapById(extractList(after, key));
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const id of aMap.keys()) {
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  for (const id of bMap.keys()) {
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  const present = (i: Record<string, unknown> | undefined): string | null =>
    i ? represent(i, mode) : null;
  const out: AnchorChange[] = [];
  for (const id of ids) {
    const b = bMap.get(id);
    const a = aMap.get(id);
    const item = a ?? b;
    if (!item) continue;
    const beforeText = present(b);
    const afterText = present(a);
    let status: AnchorChangeStatus;
    if (!b) status = 'added';
    else if (!a) status = 'removed';
    else if (beforeText !== afterText) status = 'modified';
    else continue;
    out.push({
      id,
      status,
      anchorType: typeof item['anchorType'] === 'string' ? (item['anchorType'] as string) : '',
      anchor: shortAnchor(typeof item['anchor'] === 'string' ? (item['anchor'] as string) : ''),
      before: beforeText,
      after: afterText,
    });
  }
  return out;
}

function extractList(file: unknown, key: string): readonly Record<string, unknown>[] {
  if (!file || typeof file !== 'object') return [];
  const list = (file as Record<string, unknown>)[key];
  if (!Array.isArray(list)) return [];
  return list.filter(
    (x): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x),
  );
}

function mapById(list: readonly Record<string, unknown>[]): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  for (const item of list) {
    const id = item['id'];
    if (typeof id === 'string') map.set(id, item);
  }
  return map;
}

function represent(item: Record<string, unknown>, mode: AnchorMode): string {
  if (mode === 'drafts') {
    const before = tipTapToText(item['before']).trim();
    const after = tipTapToText(item['after']).trim();
    return `${before || '∅'} → ${after || '∅'}`;
  }
  return tipTapToText(item['body']).trim();
}

function shortAnchor(s: string): string {
  if (s.length <= 12) return s;
  return `${s.slice(0, 8)}…`;
}

export function parseAnyJson(blob: Uint8Array | null): unknown {
  if (!blob) return undefined;
  try {
    return JSON.parse(blobToText(blob)) as unknown;
  } catch {
    return undefined;
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
