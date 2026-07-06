import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { describe, expect, it } from 'vitest';

import { createBlockIdExtension } from '../block-id/block-id.ext';
import { BLOCK_ID_ATTR } from '../block-id/block-id.types';

import {
  type CommentRangeUpdate,
  createCommentRangeMappingExtension,
} from './comment-range-mapping.ext';

import type { Comment } from '@core/versioning/comments.types';

const baseComment = (range: { from: number; to: number }): Comment => ({
  id: 'c1',
  anchorType: 'block',
  anchor: 'block-1',
  range,
  body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }] },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  orphaned: false,
});

const spanComment = (span: {
  startBlockId: string;
  startOffset: number;
  endBlockId: string;
  endOffset: number;
}): Comment => ({
  id: 'c1',
  anchorType: 'range',
  anchor: span.endBlockId,
  span,
  body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }] },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  orphaned: false,
});

// "hello world" — range covers "world" (offsets 6..11, relative to block content start).
const initialContent = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      attrs: { [BLOCK_ID_ATTR]: 'block-1' },
      content: [{ type: 'text', text: 'hello world' }],
    },
  ],
};

function setup(initialRange: { from: number; to: number }) {
  let comments: readonly Comment[] = [baseComment(initialRange)];
  const applied: CommentRangeUpdate[] = [];
  const editor = new Editor({
    extensions: [
      StarterKit,
      createBlockIdExtension(),
      createCommentRangeMappingExtension({
        getComments: () => comments,
        onRangesMapped: (updates) => {
          applied.push(...updates);
          const byId = new Map(updates.map((u): [string, CommentRangeUpdate] => [u.id, u]));
          comments = comments.map((c) => {
            const u = byId.get(c.id);
            if (!u) return c;
            if ('orphaned' in u) return { ...c, orphaned: true };
            if ('span' in u) return { ...c, span: u.span };
            return { ...c, range: u.range };
          });
        },
      }),
    ],
    content: initialContent,
  });
  return { editor, applied, getComments: () => comments };
}

// Two-block doc — "hello" (block-1) and "world" (block-2) — used to exercise
// 19.16e-iii spans that cross block boundaries.
const twoBlockContent = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      attrs: { [BLOCK_ID_ATTR]: 'block-1' },
      content: [{ type: 'text', text: 'hello' }],
    },
    {
      type: 'paragraph',
      attrs: { [BLOCK_ID_ATTR]: 'block-2' },
      content: [{ type: 'text', text: 'world' }],
    },
  ],
};

function setupSpan(comment: Comment) {
  let comments: readonly Comment[] = [comment];
  const applied: CommentRangeUpdate[] = [];
  const editor = new Editor({
    extensions: [
      StarterKit,
      createBlockIdExtension(),
      createCommentRangeMappingExtension({
        getComments: () => comments,
        onRangesMapped: (updates) => {
          applied.push(...updates);
          const byId = new Map(updates.map((u): [string, CommentRangeUpdate] => [u.id, u]));
          comments = comments.map((c) => {
            const u = byId.get(c.id);
            if (!u) return c;
            if ('orphaned' in u) return { ...c, orphaned: true };
            if ('span' in u) return { ...c, span: u.span };
            return { ...c, range: u.range };
          });
        },
      }),
    ],
    content: twoBlockContent,
  });
  return { editor, applied, getComments: () => comments };
}

describe('createCommentRangeMappingExtension — multi-block span (19.16e-iii)', () => {
  it('remaps both endpoints when text is inserted before the span', () => {
    const { editor, getComments } = setupSpan(
      spanComment({ startBlockId: 'block-1', startOffset: 2, endBlockId: 'block-2', endOffset: 3 }),
    );
    // why: block-1's content starts at doc pos 1; inserting there shifts
    //      every position after it (both endpoints) forward by 2.
    editor.commands.insertContentAt(1, 'XX');
    const [comment] = getComments();
    expect(comment?.span).toEqual({
      startBlockId: 'block-1',
      startOffset: 4,
      endBlockId: 'block-2',
      endOffset: 3,
    });
    expect(comment?.orphaned).toBe(false);
    editor.destroy();
  });

  it('flags a span orphaned once its content collapses', () => {
    const { editor, getComments } = setupSpan(
      spanComment({ startBlockId: 'block-1', startOffset: 2, endBlockId: 'block-2', endOffset: 3 }),
    );
    // why: absolute span is [3, 11) ("llo\nworl"); deleting all of it
    //      collapses the tracked positions to `to <= from`.
    editor.commands.deleteRange({ from: 3, to: 11 });
    const [comment] = getComments();
    expect(comment?.orphaned).toBe(true);
    editor.destroy();
  });
});

describe('createCommentRangeMappingExtension', () => {
  it('shifts the range forward when text is inserted before it', () => {
    const { editor, getComments } = setup({ from: 6, to: 11 });
    // why: block content starts at doc pos 1; inserting at pos 1 pushes
    //      everything after it (including the tracked range) forward.
    editor.commands.insertContentAt(1, 'XX');
    const [comment] = getComments();
    expect(comment?.range).toEqual({ from: 8, to: 13 });
    expect(comment?.orphaned).toBe(false);
    editor.destroy();
  });

  it('leaves the range untouched when the edit happens after it', () => {
    const { editor, applied, getComments } = setup({ from: 6, to: 11 });
    editor.commands.insertContentAt(12, '!');
    expect(applied).toEqual([]);
    const [comment] = getComments();
    expect(comment?.range).toEqual({ from: 6, to: 11 });
    editor.destroy();
  });

  it('flags the comment orphaned once the range collapses', () => {
    const { editor, getComments } = setup({ from: 6, to: 11 });
    // why: deleting doc positions 7..12 ("world", absolute) removes the
    //      entire commented text, collapsing to <= from.
    editor.commands.deleteRange({ from: 7, to: 12 });
    const [comment] = getComments();
    expect(comment?.orphaned).toBe(true);
    editor.destroy();
  });

  // why: a host that reacts to onRangesMapped by re-dispatching a
  //      transaction (e.g. pushing the updated list back through
  //      COMMENT_CLOUDS_META_KEY, as EditorComponent does) must not get
  //      the same orphan verdict reported again on every subsequent
  //      dispatch — that resonance is exactly what overflowed the call
  //      stack before collectUpdates started skipping already-orphaned
  //      comments.
  it('reports a collapsed range as orphaned only once, not on every later transaction', () => {
    const { editor, applied } = setup({ from: 6, to: 11 });
    editor.commands.deleteRange({ from: 7, to: 12 });
    expect(applied).toEqual([{ id: 'c1', orphaned: true }]);
    editor.commands.insertContentAt(1, '!');
    expect(applied).toEqual([{ id: 'c1', orphaned: true }]);
    editor.destroy();
  });
});
