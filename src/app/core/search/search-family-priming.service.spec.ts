import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { CommentsService } from '@core/versioning/comments.service';
import type { Comment } from '@core/versioning/comments.types';
import { DraftsService } from '@core/versioning/drafts.service';
import type { DiffMark } from '@core/versioning/drafts.types';
import type { CommitSummary } from '@core/versioning/versioning.service';
import { VersioningService } from '@core/versioning/versioning.service';
import { VariantsService } from '@core/versioning/variants.service';

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

class VersioningStub {
  commits: CommitSummary[] = [];
  pathsByOid = new Map<string, readonly string[]>();
  async log(): Promise<readonly CommitSummary[]> {
    return this.commits;
  }
  async changedPaths(oid: string): Promise<readonly string[]> {
    return this.pathsByOid.get(oid) ?? [];
  }
}

class VariantsStub {
  getActive(): null {
    return null;
  }
}

describe('SearchFamilyPrimingService', () => {
  let svc: SearchFamilyPrimingService;
  let comments: CommentsStub;
  let drafts: DraftsStub;
  let versioning: VersioningStub;
  let search: SearchIndexService;

  beforeEach(async () => {
    comments = new CommentsStub();
    drafts = new DraftsStub();
    versioning = new VersioningStub();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: CommentsService, useValue: comments as unknown as CommentsService },
        { provide: DraftsService, useValue: drafts as unknown as DraftsService },
        { provide: VersioningService, useValue: versioning as unknown as VersioningService },
        { provide: VariantsService, useValue: new VariantsStub() as unknown as VariantsService },
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

  it('indexes commit messages, findable by full text', async () => {
    versioning.commits = [
      { oid: 'aaaa1', message: 'auto: 3 notes', authorTimestamp: 0, parents: [] },
    ];
    await svc.primeActiveFamily();
    const hits = search.query({ text: 'notes' });
    expect(hits.map((h) => h.id)).toContain('commit:aaaa1');
    expect(hits.find((h) => h.id === 'commit:aaaa1')?.kind).toBe('commit');
  });

  it('folds touched entity titles into the commit body when resolvable', async () => {
    // "index" the entity first so getTitle(id) can resolve it, same as the
    // real notes/tasks/etc. services do via search.upsert() on save.
    await search.upsert({
      id: 'note-1',
      kind: 'note',
      title: 'Plan de vuelo',
      body: '',
      tagIds: [],
    });
    versioning.commits = [
      { oid: 'bbbb2', message: 'auto: 1 note', authorTimestamp: 0, parents: [] },
    ];
    versioning.pathsByOid.set('bbbb2', ['notes/note-1.json']);
    await svc.primeActiveFamily();
    const hit = search.query({ text: 'vuelo' }).find((h) => h.id === 'commit:bbbb2');
    expect(hit).toBeTruthy();
  });

  it('still indexes by message when changedPaths fails for a commit', async () => {
    versioning.commits = [
      { oid: 'cccc3', message: 'auto: root commit', authorTimestamp: 0, parents: [] },
    ];
    versioning.changedPaths = async () => {
      throw new Error('no parent tree');
    };
    await svc.primeActiveFamily();
    expect(search.query({ text: 'root' }).map((h) => h.id)).toEqual(['commit:cccc3']);
  });
});
