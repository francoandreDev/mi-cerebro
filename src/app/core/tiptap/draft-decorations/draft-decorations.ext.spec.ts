import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { describe, expect, it, vi } from 'vitest';

import { createBlockIdExtension } from '../block-id/block-id.ext';
import { BLOCK_ID_ATTR } from '../block-id/block-id.types';

import {
  DRAFT_DECORATIONS_META_KEY,
  createDraftDecorationsExtension,
} from './draft-decorations.ext';

import type { DiffMark } from '@core/versioning/drafts.types';

const initialContent = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      attrs: { [BLOCK_ID_ATTR]: 'block-1' },
      content: [{ type: 'text', text: 'hello' }],
    },
  ],
};

const insertMark: DiffMark = {
  id: 'm1',
  anchorType: 'block',
  anchor: 'new-block',
  before: { type: 'paragraph' },
  after: { type: 'paragraph', content: [{ type: 'text', text: 'nuevo texto' }] },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const mutateMark: DiffMark = {
  id: 'm2',
  anchorType: 'block',
  anchor: 'block-1',
  before: { type: 'paragraph', content: [{ type: 'text', text: 'hello' }] },
  after: { type: 'paragraph', content: [{ type: 'text', text: 'hi' }] },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function setup(onClick = vi.fn()) {
  const editor = new Editor({
    extensions: [
      StarterKit,
      createBlockIdExtension(),
      createDraftDecorationsExtension({ onClick, ariaLabel: () => 'aria' }),
    ],
    content: initialContent,
  });
  const push = (marks: readonly DiffMark[]): void => {
    editor.view.dispatch(editor.view.state.tr.setMeta(DRAFT_DECORATIONS_META_KEY, marks));
  };
  return { editor, push, onClick };
}

describe('createDraftDecorationsExtension (19.16e-iv)', () => {
  it('renders no widget when there are no insert marks', () => {
    const { editor, push } = setup();
    push([mutateMark]);
    expect(editor.view.dom.querySelector('.mc-draft-insert')).toBeNull();
    expect(editor.view.dom.querySelector('.mc-draft-mutate')).not.toBeNull();
  });

  it('renders an insertion-only mark as a ghost widget at the end of the doc', () => {
    const { editor, push } = setup();
    push([insertMark]);
    const widget = editor.view.dom.querySelector('.mc-draft-insert');
    expect(widget).not.toBeNull();
    expect(widget?.getAttribute('data-draft-id')).toBe('m1');
    expect(widget?.textContent).toBe('nuevo texto');
    // why: it must sit after the last real block, not clobber it.
    const paragraphs = editor.view.dom.querySelectorAll(':scope > p');
    expect(paragraphs[0]?.textContent).toBe('hello');
  });

  it('delegates clicks on the widget to the onClick handler', () => {
    const onClick = vi.fn();
    const { push, editor } = setup(onClick);
    push([insertMark]);
    const widget = editor.view.dom.querySelector('.mc-draft-insert') as HTMLElement;
    widget.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onClick).toHaveBeenCalledWith('m1');
  });

  it('ignores insert marks whose anchorType is doc', () => {
    const { editor, push } = setup();
    push([{ ...insertMark, anchorType: 'doc', anchor: 'entity-1' }]);
    expect(editor.view.dom.querySelector('.mc-draft-insert')).toBeNull();
  });
});
