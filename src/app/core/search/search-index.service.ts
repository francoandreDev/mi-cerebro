import { Injectable, inject, signal } from '@angular/core';
import MiniSearch from 'minisearch';
import type { Options as MiniSearchOptions } from 'minisearch';

import { IdbService } from '@core/idb/idb.service';

import {
  SEARCH_INDEX_KEY,
  SEARCH_INDEX_VERSION,
  type EntityKind,
  type SearchDoc,
  type SearchHit,
  type SearchQuery,
  type SearchSnippet,
} from './search.types';

interface DocMeta {
  readonly kind: string;
  readonly title: string;
  readonly body: string;
  readonly tagIds: readonly string[];
}

interface PersistedIndex {
  readonly version: number;
  readonly snapshot: string;
  readonly meta: Readonly<Record<string, DocMeta>>;
}

const OPTIONS: MiniSearchOptions = {
  fields: ['title', 'body'],
  storeFields: ['id'],
  searchOptions: {
    boost: { title: 3 },
    prefix: true,
    fuzzy: 0.2,
    combineWith: 'AND',
  },
  extractField: (doc, name) => (doc as unknown as Record<string, string>)[name] ?? '',
};

const SNIPPET_LIMIT = 160;
const SNIPPET_WINDOW_RADIUS = 70;

const norm = (s: string): string => s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

const flatten = (body: string): string => body.replace(/\s+/g, ' ').trim();

const fallbackSnippet = (flat: string): SearchSnippet => ({
  pre: '',
  match: '',
  post: flat.length > SNIPPET_LIMIT ? `${flat.slice(0, SNIPPET_LIMIT - 1)}…` : flat,
});

// why: MiniSearch has no positional index (pure inverted index), so the match offset
// is found by re-scanning the normalized flat body for the earliest matched term and
// mapping that offset back onto the original (non-normalized) text for display.
const buildSnippet = (flat: string, matchedTerms: readonly string[]): SearchSnippet => {
  if (matchedTerms.length === 0) return fallbackSnippet(flat);
  const normFlat = norm(flat);
  let bestIndex = -1;
  let bestLength = 0;
  for (const term of matchedTerms) {
    const index = normFlat.indexOf(term);
    if (index === -1) continue;
    if (bestIndex === -1 || index < bestIndex) {
      bestIndex = index;
      bestLength = term.length;
    }
  }
  if (bestIndex === -1) return fallbackSnippet(flat);

  const start = Math.max(0, bestIndex - SNIPPET_WINDOW_RADIUS);
  const end = Math.min(flat.length, bestIndex + bestLength + SNIPPET_WINDOW_RADIUS);
  return {
    pre: (start > 0 ? '…' : '') + flat.slice(start, bestIndex),
    match: flat.slice(bestIndex, bestIndex + bestLength),
    post: flat.slice(bestIndex + bestLength, end) + (end < flat.length ? '…' : ''),
  };
};

@Injectable({ providedIn: 'root' })
export class SearchIndexService {
  private readonly idb = inject(IdbService);
  private mini = new MiniSearch(OPTIONS);
  private readonly metaById = new Map<string, DocMeta>();
  private loaded = false;
  readonly ready = signal(false);

  async load(): Promise<void> {
    if (this.loaded) return;
    const raw = await this.idb.get<PersistedIndex>('search-index', SEARCH_INDEX_KEY);
    if (raw && raw.version === SEARCH_INDEX_VERSION) {
      this.mini = MiniSearch.loadJSON(raw.snapshot, OPTIONS);
      this.metaById.clear();
      for (const [id, meta] of Object.entries(raw.meta)) this.metaById.set(id, meta);
    }
    this.loaded = true;
    this.ready.set(true);
  }

  async rebuild(docs: readonly SearchDoc[]): Promise<void> {
    this.mini = new MiniSearch(OPTIONS);
    this.metaById.clear();
    for (const doc of docs) this.indexOne(doc);
    await this.persist();
    this.loaded = true;
    this.ready.set(true);
  }

  // why: the 6 kind-owning services (notes/tasks/goals/lists/writings/books)
  //      each call this once per boot refresh(), all running concurrently —
  //      `rebuild()` wipes the *entire* shared index, so whichever finished
  //      last silently erased every other kind's docs (real bug, found
  //      2026-07-20 while a dashboard feature's cross-kind search came back
  //      empty). This only clears/reseeds entries for the given kind,
  //      leaving the other 5 kinds' entries — the concurrent calls become
  //      commutative instead of last-write-wins.
  async rebuildKind(kind: EntityKind, docs: readonly SearchDoc[]): Promise<void> {
    for (const [id, meta] of this.metaById) {
      if (meta.kind !== kind) continue;
      if (this.mini.has(id)) this.mini.discard(id);
      this.metaById.delete(id);
    }
    for (const doc of docs) this.indexOne(doc);
    await this.persist();
    this.loaded = true;
    this.ready.set(true);
  }

  async upsert(doc: SearchDoc): Promise<void> {
    if (this.mini.has(doc.id)) this.mini.discard(doc.id);
    this.indexOne(doc);
    await this.persist();
  }

  async remove(id: string): Promise<void> {
    if (!this.mini.has(id)) return;
    this.mini.discard(id);
    this.metaById.delete(id);
    await this.persist();
  }

  has(id: string): boolean {
    return this.mini.has(id);
  }

  getTitle(id: string): string | null {
    return this.metaById.get(id)?.title ?? null;
  }

  size(): number {
    return this.metaById.size;
  }

  query(q: SearchQuery): readonly SearchHit[] {
    const limit = q.limit ?? 30;
    const text = q.text.trim();
    const tagFilter = q.tagIds ?? [];
    const kindFilter = new Set(q.kinds ?? []);

    const passes = (id: string): DocMeta | null => {
      const meta = this.metaById.get(id);
      if (!meta) return null;
      if (kindFilter.size > 0 && !kindFilter.has(meta.kind)) return null;
      if (tagFilter.length > 0 && !tagFilter.every((t) => meta.tagIds.includes(t))) return null;
      return meta;
    };

    if (text === '') return this.browse(passes, limit);

    const raw = this.mini.search(text, { combineWith: q.combineWith ?? 'AND' });
    const hits: SearchHit[] = [];
    for (const r of raw) {
      const id = String(r['id']);
      const meta = passes(id);
      if (!meta) continue;
      hits.push({
        id,
        kind: meta.kind,
        title: meta.title,
        snippet: buildSnippet(meta.body, r.terms),
        score: typeof r['score'] === 'number' ? r['score'] : 0,
        tagIds: meta.tagIds,
      });
      if (hits.length >= limit) break;
    }
    return hits;
  }

  private browse(passes: (id: string) => DocMeta | null, limit: number): readonly SearchHit[] {
    const out: SearchHit[] = [];
    for (const id of this.metaById.keys()) {
      const meta = passes(id);
      if (!meta) continue;
      out.push({
        id,
        kind: meta.kind,
        title: meta.title,
        snippet: fallbackSnippet(meta.body),
        score: 0,
        tagIds: meta.tagIds,
      });
      if (out.length >= limit) break;
    }
    return out;
  }

  private indexOne(doc: SearchDoc): void {
    this.mini.add({ id: doc.id, title: doc.title, body: norm(doc.body) });
    this.metaById.set(doc.id, {
      kind: doc.kind,
      title: doc.title,
      body: flatten(doc.body),
      tagIds: doc.tagIds,
    });
  }

  private async persist(): Promise<void> {
    const meta: Record<string, DocMeta> = {};
    for (const [id, m] of this.metaById) meta[id] = m;
    const payload: PersistedIndex = {
      version: SEARCH_INDEX_VERSION,
      snapshot: JSON.stringify(this.mini.toJSON()),
      meta,
    };
    await this.idb.set('search-index', SEARCH_INDEX_KEY, payload);
  }
}
