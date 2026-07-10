import { Editor, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { describe, expect, it, vi } from 'vitest';

import {
  Citation,
  createCitationAttribution,
  focusOrCreateAttribution,
} from '@core/tiptap/citation/citation.ext';

import {
  BulletListNoAutoconvert,
  HeadingNoAutoconvert,
  HorizontalRuleNoAutoconvert,
  jsonEquals,
  OrderedListNoAutoconvert,
} from './setup-editor';

const testPlaceholders = { author: () => 'Autor', year: () => 'Año' };

const listExtensions = [
  StarterKit.configure({
    bulletList: false,
    orderedList: false,
    horizontalRule: false,
    heading: false,
    blockquote: false,
  }),
  BulletListNoAutoconvert,
  OrderedListNoAutoconvert,
  HorizontalRuleNoAutoconvert,
  HeadingNoAutoconvert,
  Citation,
  createCitationAttribution(testPlaceholders),
];

const typeText = (editor: Editor, text: string): void => {
  editor.commands.insertContent(text);
};

// why: focusOrCreateAttribution gates on editor.view.hasFocus(), which
//      jsdom never grants (no real DOM focus for contenteditable), so the
//      Tab-flow tests stub it directly. Deliberately NOT passing
//      `element` here — attaching the view to a real document.body node
//      makes ProseMirror's focus()->scrollIntoView path call
//      getClientRects(), which jsdom doesn't implement (it does no
//      layout); every other test in this file relies on the same
//      detached-view default and that path is simply never hit.
const editorWithFocusStub = (content: JSONContent): Editor => {
  const editor = new Editor({ extensions: listExtensions, content });
  vi.spyOn(editor.view, 'hasFocus').mockReturnValue(true);
  return editor;
};

describe('list autoconvert removal', () => {
  it.each(['- ', '* ', '+ '])('does not turn %j into a bullet list', (trigger) => {
    const editor = new Editor({
      extensions: listExtensions,
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
    });
    editor.commands.focus('start');
    typeText(editor, trigger);
    const doc = editor.getJSON() as JSONContent;
    expect(doc.content?.[0]?.type).toBe('paragraph');
    expect(doc.content?.[0]?.content?.[0]?.text).toBe(trigger);
    editor.destroy();
  });

  it('does not turn "1. " into an ordered list', () => {
    const editor = new Editor({
      extensions: listExtensions,
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
    });
    editor.commands.focus('start');
    typeText(editor, '1. ');
    const doc = editor.getJSON() as JSONContent;
    expect(doc.content?.[0]?.type).toBe('paragraph');
    expect(doc.content?.[0]?.content?.[0]?.text).toBe('1. ');
    editor.destroy();
  });

  it('still toggles a bullet list via the command (toolbar/shortcut path)', () => {
    const editor = new Editor({
      extensions: listExtensions,
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
      },
    });
    editor.commands.focus('start');
    editor.chain().focus().toggleBulletList().run();
    expect(editor.isActive('bulletList')).toBe(true);
    editor.destroy();
  });

  it('still toggles an ordered list via the command (toolbar/shortcut path)', () => {
    const editor = new Editor({
      extensions: listExtensions,
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
      },
    });
    editor.commands.focus('start');
    editor.chain().focus().toggleOrderedList().run();
    expect(editor.isActive('orderedList')).toBe(true);
    editor.destroy();
  });

  it.each(['---', '—-', '___ ', '*** '])('does not turn %j into a scene-break rule', (trigger) => {
    const editor = new Editor({
      extensions: listExtensions,
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
    });
    editor.commands.focus('start');
    typeText(editor, trigger);
    const doc = editor.getJSON() as JSONContent;
    expect(doc.content?.[0]?.type).toBe('paragraph');
    expect(doc.content?.[0]?.content?.[0]?.text).toBe(trigger);
    editor.destroy();
  });

  it('still inserts a scene-break rule via the command (toolbar/shortcut path)', () => {
    const editor = new Editor({
      extensions: listExtensions,
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
      },
    });
    editor.commands.focus('end');
    editor.chain().focus().setHorizontalRule().run();
    const doc = editor.getJSON() as JSONContent;
    expect(doc.content?.some((n) => n.type === 'horizontalRule')).toBe(true);
    editor.destroy();
  });

  it.each(['# ', '## '])('does not turn %j into a heading', (trigger) => {
    const editor = new Editor({
      extensions: listExtensions,
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
    });
    editor.commands.focus('start');
    typeText(editor, trigger);
    const doc = editor.getJSON() as JSONContent;
    expect(doc.content?.[0]?.type).toBe('paragraph');
    expect(doc.content?.[0]?.content?.[0]?.text).toBe(trigger);
    editor.destroy();
  });

  it('still toggles a heading via the command (toolbar/shortcut path)', () => {
    const editor = new Editor({
      extensions: listExtensions,
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
      },
    });
    editor.commands.focus('start');
    editor.chain().focus().toggleHeading({ level: 2 }).run();
    expect(editor.isActive('heading', { level: 2 })).toBe(true);
    editor.destroy();
  });

  it('does not turn "> " into a citation', () => {
    const editor = new Editor({
      extensions: listExtensions,
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
    });
    editor.commands.focus('start');
    typeText(editor, '> ');
    const doc = editor.getJSON() as JSONContent;
    expect(doc.content?.[0]?.type).toBe('paragraph');
    expect(doc.content?.[0]?.content?.[0]?.text).toBe('> ');
    editor.destroy();
  });

  it('toggling a citation on wraps the paragraph without adding an attribution yet', () => {
    const editor = new Editor({
      extensions: listExtensions,
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
      },
    });
    editor.commands.focus('start');
    editor.chain().focus().toggleCitation().run();
    expect(editor.isActive('citation')).toBe(true);
    const doc = editor.getJSON() as JSONContent;
    const citation = doc.content?.[0];
    expect(citation?.type).toBe('citation');
    expect(citation?.content?.map((n) => n.type)).toEqual(['paragraph']);
    editor.destroy();
  });

  it('toggling a citation off drops the wrapper', () => {
    const editor = new Editor({
      extensions: listExtensions,
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
      },
    });
    editor.commands.focus('start');
    editor.chain().focus().toggleCitation().run();
    editor.chain().setTextSelection(1).toggleCitation().run();
    expect(editor.isActive('citation')).toBe(false);
    const doc = editor.getJSON() as JSONContent;
    // why: StarterKit's TrailingNode extension appends an empty paragraph
    //      after any non-paragraph last block (so the cursor always has
    //      somewhere to land past e.g. a citation/list/hr) — legitimate
    //      global behavior, not something toggling a citation off removes.
    expect(doc.content?.some((n) => n.type === 'citation')).toBe(false);
    expect(doc.content?.[0]?.type).toBe('paragraph');
    expect(doc.content?.[0]?.content?.[0]?.text).toBe('x');
    editor.destroy();
  });

  it('Tab at the end of a citation’s last paragraph inserts an empty attribution atom', () => {
    const editor = editorWithFocusStub({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
    });
    editor.chain().focus().toggleCitation().run();
    // why: NOT focus('end') — StarterKit's TrailingNode extension appends
    //      an empty paragraph after the citation (see the toggle-off test
    //      above), so 'end' lands there instead of inside the citation's
    //      own paragraph. Position 3 is right after the single-char "x"
    //      text node: citation's own opening token shifts every position
    //      in its content by +1 versus the pre-wrap doc, so this is doc
    //      pos 0 (start) -> 1 (past citation open) -> 2 (past paragraph
    //      open, start of "x") -> 3 (end of "x", end of paragraph).
    editor.commands.focus(3);
    const handled = focusOrCreateAttribution(editor);
    expect(handled).toBe(true);
    const doc = editor.getJSON() as JSONContent;
    const citation = doc.content?.[0];
    expect(citation?.content?.map((n) => n.type)).toEqual(['paragraph', 'citationAttribution']);
    expect(citation?.content?.[1]?.attrs).toEqual({ author: '', year: '' });
    editor.destroy();
  });

  it('Tab elsewhere in the citation (not at the end) is a no-op', () => {
    const editor = editorWithFocusStub({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
    });
    editor.chain().focus().toggleCitation().run();
    editor.commands.focus('start');
    const handled = focusOrCreateAttribution(editor);
    expect(handled).toBe(false);
    const doc = editor.getJSON() as JSONContent;
    expect(doc.content?.[0]?.content?.map((n) => n.type)).toEqual(['paragraph']);
    editor.destroy();
  });

  it('Tab outside a citation is a no-op', () => {
    const editor = editorWithFocusStub({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
    });
    editor.commands.focus('end');
    expect(focusOrCreateAttribution(editor)).toBe(false);
    editor.destroy();
  });

  it('round-trips citation + attribution author/year through HTML', () => {
    const editor = new Editor({
      extensions: listExtensions,
      content: {
        type: 'doc',
        content: [
          {
            type: 'citation',
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: 'x' }] },
              { type: 'citationAttribution', attrs: { author: 'Ada Lovelace', year: '1843' } },
            ],
          },
        ],
      },
    });
    const html = editor.getHTML();
    expect(html).toContain('data-author="Ada Lovelace"');
    expect(html).toContain('data-year="1843"');
    editor.commands.setContent(html);
    const doc = editor.getJSON() as JSONContent;
    const attribution = doc.content?.[0]?.content?.[1];
    expect(attribution?.type).toBe('citationAttribution');
    expect(attribution?.attrs).toEqual({ author: 'Ada Lovelace', year: '1843' });
    editor.destroy();
  });
});

describe('jsonEquals', () => {
  it('compares by structural JSON equality', () => {
    const a = { type: 'doc', content: [] };
    const b = { type: 'doc', content: [] };
    expect(jsonEquals(a, b)).toBe(true);
    expect(jsonEquals(a, { ...b, type: 'other' })).toBe(false);
  });
});
