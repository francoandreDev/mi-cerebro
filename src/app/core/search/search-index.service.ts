import { Injectable, inject, signal } from '@angular/core';
import MiniSearch from 'minisearch';
import type { Options as MiniSearchOptions } from 'minisearch';

import { IdbService } from '@core/idb/idb.service';

import {
  SEARCH_INDEX_KEY,
  SEARCH_INDEX_VERSION,
  type SearchDoc,
  type SearchHit,
  type SearchQuery,
} from './search.types';

interface DocMeta {
  readonly kind: string;
  readonly title: string;
  readonly snippet: string;
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

const norm = (s: string): string => s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

const toSnippet = (body: string): string => {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > SNIPPET_LIMIT ? `${flat.slice(0, SNIPPET_LIMIT - 1)}…` : flat;
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

    const raw = this.mini.search(text);
    const hits: SearchHit[] = [];
    for (const r of raw) {
      const id = String(r['id']);
      const meta = passes(id);
      if (!meta) continue;
      hits.push({
        id,
        kind: meta.kind,
        title: meta.title,
        snippet: meta.snippet,
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
        snippet: meta.snippet,
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
      snippet: toSnippet(doc.body),
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
