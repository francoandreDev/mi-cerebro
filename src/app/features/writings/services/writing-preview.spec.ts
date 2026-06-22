import type { JSONContent } from '@tiptap/core';

import { buildWritingPreview } from './writing-preview';

const doc = (content: JSONContent[]): JSONContent => ({ type: 'doc', content });
const para = (text: string): JSONContent => ({
  type: 'paragraph',
  content: text ? [{ type: 'text', text }] : [],
});

describe('buildWritingPreview', () => {
  it('returns empty for missing body', () => {
    expect(buildWritingPreview(undefined)).toEqual({ preview: '', wordCount: 0 });
  });

  it('returns empty for whitespace-only body', () => {
    const body = doc([para(''), para('   ')]);
    expect(buildWritingPreview(body)).toEqual({ preview: '', wordCount: 0 });
  });

  it('counts words and returns full text when short', () => {
    const body = doc([para('hola mundo desde tiptap')]);
    const out = buildWritingPreview(body);
    expect(out.wordCount).toBe(4);
    expect(out.preview).toBe('hola mundo desde tiptap');
  });

  it('clamps long previews with an ellipsis', () => {
    const long = 'palabra '.repeat(80).trim();
    const body = doc([para(long)]);
    const out = buildWritingPreview(body);
    expect(out.preview.endsWith('…')).toBe(true);
    expect(out.preview.length).toBe(240);
    expect(out.wordCount).toBe(80);
  });
});
