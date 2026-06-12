// 13d-ii — buildBlockDiffMarks unit tests. Pure function, no DI.

import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';

import { buildBlockDiffMarks } from './draft-capture';

const NOW = '2026-06-12T00:00:00.000Z';

let counter = 0;
const genId = (): string => `m-${++counter}`;

function doc(...blocks: JSONContent[]): JSONContent {
  return { type: 'doc', content: blocks };
}

function para(blockId: string | null, text: string): JSONContent {
  const attrs = blockId === null ? {} : { blockId };
  return { type: 'paragraph', attrs, content: [{ type: 'text', text }] };
}

describe('buildBlockDiffMarks', () => {
  it('returns no marks when before and after are identical', () => {
    const d = doc(para('a', 'hello'), para('b', 'world'));
    expect(buildBlockDiffMarks({ before: d, after: d, now: NOW, genId })).toEqual([]);
  });

  it('emits one mark when a single block changes', () => {
    const before = doc(para('a', 'old'), para('b', 'world'));
    const after = doc(para('a', 'new'), para('b', 'world'));
    const marks = buildBlockDiffMarks({ before, after, now: NOW, genId });
    expect(marks).toHaveLength(1);
    expect(marks[0]!.anchor).toBe('a');
    expect(marks[0]!.anchorType).toBe('block');
    expect(marks[0]!.before).toEqual(para('a', 'old'));
    expect(marks[0]!.after).toEqual(para('a', 'new'));
  });

  it('emits an insertion mark when a new block appears in `after`', () => {
    const before = doc(para('a', 'hello'));
    const after = doc(para('a', 'hello'), para('new', 'inserted'));
    const marks = buildBlockDiffMarks({ before, after, now: NOW, genId });
    expect(marks).toHaveLength(1);
    expect(marks[0]!.anchor).toBe('new');
    expect(marks[0]!.before).toEqual({ type: 'paragraph' });
    expect(marks[0]!.after).toEqual(para('new', 'inserted'));
  });

  it('emits a deletion mark when a block disappears in `after`', () => {
    const before = doc(para('a', 'hello'), para('b', 'gone'));
    const after = doc(para('a', 'hello'));
    const marks = buildBlockDiffMarks({ before, after, now: NOW, genId });
    expect(marks).toHaveLength(1);
    expect(marks[0]!.anchor).toBe('b');
    expect(marks[0]!.before).toEqual(para('b', 'gone'));
    expect(marks[0]!.after).toEqual({ type: 'paragraph' });
  });

  it('skips blocks without a stable blockId (transient state)', () => {
    const before = doc(para('a', 'old'));
    const after = doc(para('a', 'old'), para(null, 'no-id-yet'));
    expect(buildBlockDiffMarks({ before, after, now: NOW, genId })).toEqual([]);
  });

  it('stamps createdAt/updatedAt with the provided `now`', () => {
    const before = doc(para('a', 'old'));
    const after = doc(para('a', 'new'));
    const [m] = buildBlockDiffMarks({ before, after, now: NOW, genId });
    expect(m!.createdAt).toBe(NOW);
    expect(m!.updatedAt).toBe(NOW);
  });
});
