import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { IdbService } from '@core/idb/idb.service';

import { SearchIndexService } from './search-index.service';
import type { SearchDoc } from './search.types';

const doc = (id: string, title: string, body: string, tagIds: string[] = []): SearchDoc => ({
  id,
  kind: 'note',
  title,
  body,
  tagIds,
});

describe('SearchIndexService', () => {
  let svc: SearchIndexService;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const idb = TestBed.inject(IdbService);
    await idb.clear('search-index');
    svc = TestBed.inject(SearchIndexService);
    await svc.load();
  });

  it('starts empty after load with no persisted data', () => {
    expect(svc.size()).toBe(0);
    expect(svc.query({ text: 'anything' })).toEqual([]);
  });

  it('rebuild indexes all docs', async () => {
    await svc.rebuild([
      doc('a', 'Reunión', 'Notas de la reunión semanal'),
      doc('b', 'Lista de compras', 'pan leche queso'),
    ]);
    expect(svc.size()).toBe(2);
    const hits = svc.query({ text: 'reunion' });
    expect(hits.map((h) => h.id)).toContain('a');
  });

  it('boosts title matches above body matches', async () => {
    await svc.rebuild([
      doc('a', 'Receta de pan', 'algo cualquiera'),
      doc('b', 'Algo más', 'mencionando pan en el cuerpo'),
    ]);
    const hits = svc.query({ text: 'pan' });
    expect(hits[0]?.id).toBe('a');
  });

  it('upsert replaces an existing doc', async () => {
    await svc.rebuild([doc('a', 'viejo', 'contenido viejo')]);
    await svc.upsert(doc('a', 'nuevo', 'contenido fresco'));
    const hits = svc.query({ text: 'fresco' });
    expect(hits[0]?.id).toBe('a');
    expect(svc.query({ text: 'viejo' })).toEqual([]);
  });

  it('remove drops a doc from the index', async () => {
    await svc.rebuild([doc('a', 'algo', 'cosas')]);
    await svc.remove('a');
    expect(svc.has('a')).toBe(false);
    expect(svc.query({ text: 'cosas' })).toEqual([]);
  });

  it('filters by tagIds (AND semantics)', async () => {
    await svc.rebuild([doc('a', 'uno', 'cuerpo', ['t1', 't2']), doc('b', 'dos', 'cuerpo', ['t1'])]);
    const hits = svc.query({ text: 'cuerpo', tagIds: ['t1', 't2'] });
    expect(hits.map((h) => h.id)).toEqual(['a']);
  });

  it('browses by tag with no text query', async () => {
    await svc.rebuild([doc('a', 'uno', '', ['t1']), doc('b', 'dos', '', ['t2'])]);
    const hits = svc.query({ text: '', tagIds: ['t1'] });
    expect(hits.map((h) => h.id)).toEqual(['a']);
  });

  it('persists across service re-load', async () => {
    await svc.rebuild([doc('a', 'persiste', 'cuerpo')]);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const fresh = TestBed.inject(SearchIndexService);
    await fresh.load();
    expect(fresh.has('a')).toBe(true);
    expect(fresh.query({ text: 'persiste' })[0]?.id).toBe('a');
  });

  it('returns title and snippet in hits', async () => {
    await svc.rebuild([doc('a', 'Receta', 'Mezclar harina y agua hasta formar masa')]);
    const hit = svc.query({ text: 'masa' })[0];
    expect(hit?.title).toBe('Receta');
    const snippet = hit?.snippet;
    expect((snippet?.pre ?? '') + (snippet?.match ?? '') + (snippet?.post ?? '')).toContain(
      'Mezclar',
    );
  });

  it('centers the snippet on the match and highlights it', async () => {
    const filler = 'palabra '.repeat(40).trim();
    await svc.rebuild([doc('a', 'Doc', `${filler} objetivo ${filler}`)]);
    const hit = svc.query({ text: 'objetivo' })[0];
    expect(hit?.snippet.match).toBe('objetivo');
    expect(hit?.snippet.pre.startsWith('…')).toBe(true);
    expect(hit?.snippet.post.endsWith('…')).toBe(true);
    expect(hit?.snippet.pre.length).toBeLessThan(filler.length);
  });

  it('falls back to a plain leading snippet when there is no query text', async () => {
    await svc.rebuild([doc('a', 'Doc', 'contenido sin busqueda activa')]);
    const hit = svc.query({ text: '' })[0];
    expect(hit?.snippet.match).toBe('');
    expect(hit?.snippet.post).toContain('contenido sin busqueda activa');
  });

  it('produces accent-insensitive matches', async () => {
    await svc.rebuild([doc('a', 'algo', 'reunión con clientes')]);
    expect(svc.query({ text: 'reunion' })[0]?.id).toBe('a');
  });
});
