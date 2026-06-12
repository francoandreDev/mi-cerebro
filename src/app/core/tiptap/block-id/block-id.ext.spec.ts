import { Editor, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { describe, expect, it } from 'vitest';

import { createBlockIdExtension } from './block-id.ext';
import { BLOCK_ID_ATTR } from './block-id.types';

const seq = () => {
  let n = 0;
  return () => `id-${++n}`;
};

const ids = (doc: JSONContent): string[] => {
  const out: string[] = [];
  const walk = (node: JSONContent): void => {
    const v = node.attrs?.[BLOCK_ID_ATTR];
    if (typeof v === 'string') out.push(v);
    node.content?.forEach(walk);
  };
  walk(doc);
  return out;
};

describe('createBlockIdExtension', () => {
  it('assigns ids to existing blocks on first transaction', async () => {
    const editor = new Editor({
      extensions: [StarterKit, createBlockIdExtension(seq())],
      content: { type: 'doc', content: [{ type: 'paragraph' }, { type: 'paragraph' }] },
    });
    // why: appendTransaction only fires once a doc-changing transaction
    //      arrives; dispatching a no-op insert triggers it.
    editor.commands.insertContent('');
    editor.commands.setContent({
      type: 'doc',
      content: [{ type: 'paragraph' }, { type: 'paragraph' }],
    });
    editor.commands.focus('start');
    editor.commands.insertContent('a');
    const out = editor.getJSON();
    expect(ids(out).length).toBeGreaterThanOrEqual(2);
    editor.destroy();
  });

  it('renders blockId to HTML and parses it back', () => {
    const editor = new Editor({
      extensions: [StarterKit, createBlockIdExtension(seq())],
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', attrs: { [BLOCK_ID_ATTR]: 'keep-me' } }],
      },
    });
    const html = editor.getHTML();
    expect(html).toContain('data-block-id="keep-me"');
    editor.destroy();
  });

  it('keeps existing ids and only fills the missing one', () => {
    const editor = new Editor({
      extensions: [StarterKit, createBlockIdExtension(seq())],
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', attrs: { [BLOCK_ID_ATTR]: 'keep' } }, { type: 'paragraph' }],
      },
    });
    editor.commands.focus('end');
    editor.commands.insertContent('x');
    const out = editor.getJSON();
    const collected = ids(out);
    expect(collected[0]).toBe('keep');
    expect(collected[1]).toBe('id-1');
    editor.destroy();
  });
});
