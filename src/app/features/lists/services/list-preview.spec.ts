import type { JSONContent } from '@tiptap/core';

import { buildListPreview } from './list-preview';

const doc = (content: JSONContent[]): JSONContent => ({ type: 'doc', content });
const bulletList = (items: JSONContent[]): JSONContent => ({ type: 'bulletList', content: items });
const listItem = (text: string): JSONContent => ({
  type: 'listItem',
  content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }],
});

describe('buildListPreview', () => {
  it('returns empty for missing body', () => {
    expect(buildListPreview(undefined)).toEqual({ items: [], itemCount: 0 });
  });

  it('skips empty list items so empty docs report zero', () => {
    const body = doc([bulletList([listItem('')])]);
    expect(buildListPreview(body)).toEqual({ items: [], itemCount: 0 });
  });

  it('keeps up to 4 items in items[] but counts the total', () => {
    const body = doc([
      bulletList([
        listItem('a'),
        listItem('b'),
        listItem('c'),
        listItem('d'),
        listItem('e'),
        listItem('f'),
      ]),
    ]);
    const out = buildListPreview(body);
    expect(out.items).toEqual(['a', 'b', 'c', 'd']);
    expect(out.itemCount).toBe(6);
  });

  it('clamps long items with an ellipsis', () => {
    const long = 'x'.repeat(200);
    const body = doc([bulletList([listItem(long)])]);
    const out = buildListPreview(body);
    expect(out.items[0]?.endsWith('…')).toBe(true);
    expect(out.items[0]?.length).toBe(120);
  });

  it('walks ordered lists too', () => {
    const body = doc([{ type: 'orderedList', content: [listItem('one'), listItem('two')] }]);
    expect(buildListPreview(body)).toEqual({ items: ['one', 'two'], itemCount: 2 });
  });
});
