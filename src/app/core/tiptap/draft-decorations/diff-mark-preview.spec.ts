import { describe, expect, it } from 'vitest';

import { renderDiffMarkPreview } from './diff-mark-preview';

describe('renderDiffMarkPreview', () => {
  it('renders a plain paragraph', () => {
    const el = renderDiffMarkPreview({
      type: 'paragraph',
      content: [{ type: 'text', text: 'hola mundo' }],
    });
    expect(el.tagName).toBe('P');
    expect(el.textContent).toBe('hola mundo');
  });

  it('maps heading level to the matching h tag', () => {
    const el = renderDiffMarkPreview({
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: 'Título' }],
    });
    expect(el.tagName).toBe('H3');
  });

  it('wraps inline marks, including nested ones', () => {
    const el = renderDiffMarkPreview({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'fuerte', marks: [{ type: 'bold' }] },
        {
          type: 'text',
          text: 'resaltado',
          marks: [{ type: 'italic' }, { type: 'highlight', attrs: { color: 'yellow' } }],
        },
      ],
    });
    expect(el.querySelector('strong')?.textContent).toBe('fuerte');
    const mark = el.querySelector('mark');
    expect(mark?.getAttribute('data-color')).toBe('yellow');
    expect(mark?.querySelector('em')?.textContent).toBe('resaltado');
  });

  it('renders nested lists', () => {
    const el = renderDiffMarkPreview({
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'item 1' }] }],
        },
      ],
    });
    expect(el.tagName).toBe('UL');
    expect(el.querySelector('li p')?.textContent).toBe('item 1');
  });

  it('renders a code block as pre>code', () => {
    const el = renderDiffMarkPreview({
      type: 'codeBlock',
      content: [{ type: 'text', text: 'const x = 1;' }],
    });
    expect(el.tagName).toBe('PRE');
    expect(el.querySelector('code')?.textContent).toBe('const x = 1;');
  });

  it('falls back to a div for unknown node types', () => {
    const el = renderDiffMarkPreview({
      type: 'somethingUnexpected',
      content: [{ type: 'text', text: 'plain' }],
    });
    expect(el.tagName).toBe('DIV');
    expect(el.textContent).toBe('plain');
  });

  it('renders horizontalRule as a void element', () => {
    const el = renderDiffMarkPreview({ type: 'horizontalRule' });
    expect(el.tagName).toBe('HR');
  });
});
