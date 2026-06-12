import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';

import { BLOCK_ID_ATTR } from './block-id.types';
import { injectBlockIds } from './inject-block-ids';

const seq = () => {
  let n = 0;
  return () => `id-${++n}`;
};

const blockIdsAt = (doc: JSONContent, ...path: number[]): string | undefined => {
  let cur: JSONContent | undefined = doc;
  for (const i of path) cur = cur?.content?.[i];
  const v = cur?.attrs?.[BLOCK_ID_ATTR];
  return typeof v === 'string' ? v : undefined;
};

describe('injectBlockIds', () => {
  it('returns non-doc shapes untouched (Book without body, etc.)', () => {
    const data: JSONContent = { type: 'paragraph', content: [] };
    expect(injectBlockIds(data, seq())).toBe(data);
  });

  it('assigns ids to paragraphs, headings and listItems', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 } },
        { type: 'paragraph' },
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph' }] },
            { type: 'listItem', content: [{ type: 'paragraph' }] },
          ],
        },
      ],
    };
    const out = injectBlockIds(doc, seq());
    expect(blockIdsAt(out, 0)).toBe('id-1');
    expect(blockIdsAt(out, 1)).toBe('id-2');
    expect(blockIdsAt(out, 2, 0)).toBe('id-3');
    // why: the paragraph inside the listItem also gets an id; cheap and
    //      keeps the walker simple, even if comments usually anchor on
    //      the listItem itself.
    expect(blockIdsAt(out, 2, 0, 0)).toBe('id-4');
    expect(blockIdsAt(out, 2, 1)).toBe('id-5');
  });

  it('preserves valid existing ids (idempotent on the migrated doc)', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', attrs: { [BLOCK_ID_ATTR]: 'keep-me' } },
        { type: 'paragraph' },
      ],
    };
    const out = injectBlockIds(doc, seq());
    expect(blockIdsAt(out, 0)).toBe('keep-me');
    expect(blockIdsAt(out, 1)).toBe('id-1');
    expect(injectBlockIds(out, seq())).toEqual(out);
  });

  it('re-assigns duplicate ids (e.g. produced by paste)', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', attrs: { [BLOCK_ID_ATTR]: 'dup' } },
        { type: 'paragraph', attrs: { [BLOCK_ID_ATTR]: 'dup' } },
      ],
    };
    const out = injectBlockIds(doc, seq());
    expect(blockIdsAt(out, 0)).toBe('dup');
    expect(blockIdsAt(out, 1)).toBe('id-1');
  });

  it('ignores nodes outside the target set (e.g. text, doc itself)', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hola' }] }],
    };
    const out = injectBlockIds(doc, seq());
    expect(blockIdsAt(out)).toBeUndefined();
    expect(blockIdsAt(out, 0, 0)).toBeUndefined();
  });
});
