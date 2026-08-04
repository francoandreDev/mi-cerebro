import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { CommentsService } from '@core/versioning/comments.service';
import type { Comment } from '@core/versioning/comments.types';
import { DraftsService } from '@core/versioning/drafts.service';
import type { DiffMark } from '@core/versioning/drafts.types';

import { SearchFamilyPrimingService } from './search-family-priming.service';
import { SearchIndexService } from './search-index.service';

const comment = (id: string, text: string): Comment => ({
  id,
  anchorType: 'entity',
  anchor: 'entity-1',
  body: { type: 'doc', content: [{ type: 'text', text }] },
  createdAt: '2026-06-12T00:00:00Z',
  updatedAt: '2026-06-12T00:00:00Z',
  orphaned: false,
});

const mark = (id: string, text: string): DiffMark => ({
  id,
  anchorType: 'block',
  anchor: 'block-1',
  before: { type: 'paragraph' },
  after: { type: 'paragraph', content: [{ type: 'text', text }] },
  createdAt: '2026-06-12T00:00:00Z',
  updatedAt: '2026-06-12T00:00:00Z',
});

class CommentsStub {
  entityComments = new Map<string, readonly Comment[]>();
  async listEntityIds(): Promise<readonly string[]> {
    return [...this.entityComments.keys()];
  }
  async read(entityId: string): Promise<{ comments: readonly Comment[] }> {
    return { comments: this.entityComments.get(entityId) ?? [] };
  }
}

class DraftsStub {
  entityMarks = new Map<string, readonly DiffMark[]>();
  async listEntityIds(): Promise<readonly string[]> {
    return [...this.entityMarks.keys()];
  }
  async read(entityId: string): Promise<{ marks: readonly DiffMark[] }> {
    return { marks: this.entityMarks.get(entityId) ?? [] };
  }
}

describe('SearchFamilyPrimingService', () => {
  let svc: SearchFamilyPrimingService;
  let comments: CommentsStub;
  let drafts: DraftsStub;
  let search: SearchIndexService;

  beforeEach(async () => {
    comments = new CommentsStub();
    drafts = new DraftsStub();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: CommentsService, useValue: comments as unknown as CommentsService },
        { provide: DraftsService, useValue: drafts as unknown as DraftsService },
      ],
    });
    search = TestBed.inject(SearchIndexService);
    svc = TestBed.inject(SearchFamilyPrimingService);
  });

  it('indexes comments and drafts for every discovered entity', async () => {
    comments.entityComments.set('e1', [comment('c1', 'hola mundo')]);
    drafts.entityMarks.set('e2', [mark('m1', 'cambio propuesto')]);

    await svc.primeActiveFamily();

    expect(search.query({ text: 'hola' }).map((h) => h.id)).toEqual(['comment:e1:c1']);
    expect(search.query({ text: 'propuesto' }).map((h) => h.id)).toEqual(['draft:e2:m1']);
  });

  it('falls back to the entity id as title when the entity itself is not indexed', async () => {
    comments.entityComments.set('unknown-entity', [comment('c1', 'texto')]);
    await svc.primeActiveFamily();
    expect(search.query({ text: 'texto' })[0]?.title).toBe('unknown-entity');
  });

  it('re-priming replaces the previous snapshot instead of accumulating duplicates', async () => {
    comments.entityComments.set('e1', [comment('c1', 'primero')]);
    await svc.primeActiveFamily();
    comments.entityComments.set('e1', [comment('c1', 'segundo')]);
    await svc.primeActiveFamily();
    expect(search.query({ text: 'primero' })).toEqual([]);
    expect(search.query({ text: 'segundo' }).map((h) => h.id)).toEqual(['comment:e1:c1']);
  });
});
