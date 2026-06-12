// 13d-iii — applyMarkToDoc / markCategory unit tests. Pure, no DI.

import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';

import { applyMarkToDoc, markCategory } from './draft-apply';
import type { DiffMark } from './drafts.types';

const NOW = '2026-06-12T00:00:00.000Z';
const EMPTY: JSONContent = { type: 'paragraph' };

function doc(...blocks: JSONContent[]): JSONContent {
  return { type: 'doc', content: blocks };
}

function para(blockId: string, text: string): JSONContent {
  return { type: 'paragraph', attrs: { blockId }, content: [{ type: 'text', text }] };
}

function mark(over: Partial<DiffMark>): DiffMark {
  return {
    id: 'm-1',
    anchorType: 'block',
    anchor: 'a',
    before: EMPTY,
    after: EMPTY,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

describe('markCategory', () => {
  it('classifies insertion (before empty, after non-empty)', () => {
    expect(markCategory(mark({ after: para('a', 'hi') }))).toBe('insert');
  });
  it('classifies deletion (before non-empty, after empty)', () => {
    expect(markCategory(mark({ before: para('a', 'gone') }))).toBe('delete');
  });
  it('classifies mutation (both non-empty)', () => {
    expect(markCategory(mark({ before: para('a', 'old'), after: para('a', 'new') }))).toBe(
      'mutate',
    );
  });
});

describe('applyMarkToDoc', () => {
  it('replaces the block in mutation', () => {
    const before = doc(para('a', 'old'), para('b', 'keep'));
    const after = applyMarkToDoc(
      before,
      mark({ before: para('a', 'old'), after: para('a', 'new') }),
    );
    expect(after.content).toEqual([para('a', 'new'), para('b', 'keep')]);
  });

  it('removes the block on deletion', () => {
    const before = doc(para('a', 'gone'), para('b', 'keep'));
    const after = applyMarkToDoc(before, mark({ before: para('a', 'gone') }));
    expect(after.content).toEqual([para('b', 'keep')]);
  });

  it('appends the block on insertion when missing', () => {
    const before = doc(para('a', 'keep'));
    const after = applyMarkToDoc(before, mark({ anchor: 'new', after: para('new', 'inserted') }));
    expect(after.content).toEqual([para('a', 'keep'), para('new', 'inserted')]);
  });

  it('is a no-op when insertion target already exists', () => {
    const before = doc(para('a', 'keep'), para('new', 'inserted'));
    const after = applyMarkToDoc(before, mark({ anchor: 'new', after: para('new', 'inserted') }));
    expect(after).toBe(before);
  });

  it('is a no-op when mutation/deletion target is missing', () => {
    const before = doc(para('b', 'keep'));
    const m = mark({ anchor: 'gone', before: para('gone', 'x'), after: para('gone', 'y') });
    expect(applyMarkToDoc(before, m)).toBe(before);
  });

  it('is a no-op for doc-anchored marks (not supported by inline apply)', () => {
    const before = doc(para('a', 'keep'));
    const m = mark({ anchorType: 'doc', anchor: 'ent', after: para('a', 'x') });
    expect(applyMarkToDoc(before, m)).toBe(before);
  });
});
