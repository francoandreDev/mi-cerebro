import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';

import { BLOCK_ID_ATTR } from '@core/tiptap/block-id/block-id.types';

import { extractBlockSummaries } from './block-summaries';

describe('extractBlockSummaries', () => {
  it('returns an empty list for an empty doc', () => {
    expect(extractBlockSummaries(undefined)).toEqual([]);
    expect(extractBlockSummaries({ type: 'doc' })).toEqual([]);
  });

  it('skips blocks without an id (e.g. pre-migration content)', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'sin id' }] }],
    };
    expect(extractBlockSummaries(doc)).toEqual([]);
  });

  it('emits paragraphs and headings in document order with a text preview', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1, [BLOCK_ID_ATTR]: 'h-1' },
          content: [{ type: 'text', text: 'Hola' }],
        },
        {
          type: 'paragraph',
          attrs: { [BLOCK_ID_ATTR]: 'p-1' },
          content: [{ type: 'text', text: 'mundo' }],
        },
      ],
    };
    const out = extractBlockSummaries(doc);
    expect(out).toEqual([
      { blockId: 'h-1', type: 'heading', preview: 'Hola' },
      { blockId: 'p-1', type: 'paragraph', preview: 'mundo' },
    ]);
  });

  it('truncates long previews with an ellipsis', () => {
    const long = 'x'.repeat(100);
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { [BLOCK_ID_ATTR]: 'p-1' },
          content: [{ type: 'text', text: long }],
        },
      ],
    };
    expect(extractBlockSummaries(doc)[0]!.preview.endsWith('…')).toBe(true);
    expect(extractBlockSummaries(doc)[0]!.preview.length).toBe(60);
  });

  it('returns an empty preview for blocks with no text (e.g. just an image)', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph', attrs: { [BLOCK_ID_ATTR]: 'p-1' } }],
    };
    expect(extractBlockSummaries(doc)[0]!.preview).toBe('');
  });
});
