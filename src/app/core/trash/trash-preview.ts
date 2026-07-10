import type { TrashKind, TrashPreview, TrashPreviewFact } from './trash.types';

const EXCERPT_MAX_CHARS = 320;

const TIPTAP_BLOCK_TYPES = new Set([
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

const tipTapToText = (doc: unknown): string => {
  if (!doc || typeof doc !== 'object') return '';
  const node = doc as { type?: string; text?: string; content?: unknown[] };
  if (node.type === 'text' && typeof node.text === 'string') return node.text;
  const inner = (node.content ?? []).map((c) => tipTapToText(c)).join('');
  return TIPTAP_BLOCK_TYPES.has(node.type ?? '') ? `${inner}\n` : inner;
};

const asString = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

const asStringArray = (v: unknown): readonly string[] => {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
};

const excerptFromBody = (body: unknown): string | null => {
  const text = tipTapToText(body).replace(/\s+/g, ' ').trim();
  if (!text) return null;
  if (text.length <= EXCERPT_MAX_CHARS) return text;
  return `${text.slice(0, EXCERPT_MAX_CHARS).trimEnd()}…`;
};

const arrayLen = (v: unknown): number => (Array.isArray(v) ? v.length : 0);

const statusFact = (done: unknown, doneKey: string, pendingKey: string): TrashPreviewFact => ({
  labelKey: 'trash.preview.status',
  value: done ? doneKey : pendingKey,
});

const previewBook = (raw: Record<string, unknown>): TrashPreview => {
  const book = (raw['book'] as Record<string, unknown> | undefined) ?? raw;
  const count = arrayLen(raw['chapters']) || arrayLen(book['order']);
  return {
    excerpt: null,
    tags: asStringArray(book['tags']),
    createdAt: asString(book['createdAt']),
    updatedAt: asString(book['updatedAt']),
    facts: [{ labelKey: 'trash.preview.chapters', value: String(count) }],
  };
};

const previewCollection = (
  raw: Record<string, unknown>,
  itemsKey: string,
  labelKey: string,
): TrashPreview => {
  const count = arrayLen(raw[itemsKey]) || arrayLen(raw['order']);
  return {
    excerpt: null,
    tags: asStringArray(raw['tags']),
    createdAt: asString(raw['createdAt']),
    updatedAt: asString(raw['updatedAt']),
    facts: [{ labelKey, value: String(count) }],
  };
};

const previewReminder = (raw: Record<string, unknown>): TrashPreview => ({
  excerpt: null,
  tags: [],
  createdAt: asString(raw['createdAt']),
  updatedAt: asString(raw['updatedAt']),
  facts: [
    { labelKey: 'trash.preview.dueAt', value: asString(raw['dueAt']) ?? '—' },
    statusFact(raw['done'], 'trash.preview.status.done', 'trash.preview.status.pending'),
  ],
});

const taskFacts = (raw: Record<string, unknown>): TrashPreviewFact[] => {
  const facts: TrashPreviewFact[] = [
    statusFact(raw['done'], 'trash.preview.status.done', 'trash.preview.status.pending'),
  ];
  const dueDates = Array.isArray(raw['dueDates']) ? (raw['dueDates'] as unknown[]) : [];
  if (dueDates.length) {
    facts.push({
      labelKey: 'trash.preview.dueDates',
      value: dueDates.filter((d): d is string => typeof d === 'string').join(', '),
    });
  }
  return facts;
};

const goalFacts = (raw: Record<string, unknown>): TrashPreviewFact[] => {
  const facts: TrashPreviewFact[] = [];
  const deadline = asString(raw['deadline']);
  if (deadline) facts.push({ labelKey: 'trash.preview.deadline', value: deadline });
  facts.push(
    statusFact(raw['completed'], 'trash.preview.status.completed', 'trash.preview.status.open'),
  );
  return facts;
};

const previewBodied = (
  raw: Record<string, unknown>,
  facts: readonly TrashPreviewFact[],
): TrashPreview => ({
  excerpt: excerptFromBody(raw['body']),
  tags: asStringArray(raw['tags']),
  createdAt: asString(raw['createdAt']),
  updatedAt: asString(raw['updatedAt']),
  facts,
});

export const buildTrashPreview = (kind: TrashKind, raw: Record<string, unknown>): TrashPreview => {
  if (kind === 'book') return previewBook(raw);
  if (kind === 'image') return previewCollection(raw, 'images', 'trash.preview.images');
  if (kind === 'file') return previewCollection(raw, 'items', 'trash.preview.files');
  if (kind === 'reminder') return previewReminder(raw);
  if (kind === 'task') return previewBodied(raw, taskFacts(raw));
  if (kind === 'goal') return previewBodied(raw, goalFacts(raw));
  return previewBodied(raw, []);
};
