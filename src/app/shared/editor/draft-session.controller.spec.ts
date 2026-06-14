// 13f — Spec for DraftSessionController. Validates the lifecycle:
// start() snapshots, captureUpdate buffers, end() persists via the
// injected DraftsService and restores the view to the snapshot. Uses
// stubs — no real TipTap editor, no real git.

import { describe, expect, it, vi } from 'vitest';
import type { Editor, JSONContent } from '@tiptap/core';

import type { DraftsService } from '@core/versioning/drafts.service';

import { DraftSessionController } from './draft-session.controller';

const docOf = (text: string): JSONContent => ({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      attrs: { blockId: 'b-1' },
      content: [{ type: 'text', text }],
    },
  ],
});

const fakeEditor = (currentJson: JSONContent): Editor =>
  ({ getJSON: () => currentJson }) as unknown as Editor;

describe('DraftSessionController', () => {
  it('start → captureUpdate → save persists marks and resolves restoreView', async () => {
    const base = docOf('original');
    const next = docOf('edited');
    const drafts = {
      save: vi.fn().mockResolvedValue(undefined),
    } as unknown as DraftsService;
    const restoreView = vi.fn();
    const onSaved = vi.fn();

    let current = base;
    const ctrl = new DraftSessionController({
      drafts,
      editor: () => fakeEditor(current),
      currentValue: () => current,
      entityId: () => 'note-1',
      entityTitle: () => 'My Note',
      restoreView,
      onSaved,
    });

    ctrl.start();
    expect(ctrl.active()).toBe(true);

    current = next;
    expect(ctrl.captureUpdate(next)).toBe(true);

    await ctrl.end();

    expect(drafts.save).toHaveBeenCalledTimes(1);
    const [id, title, marks] = (drafts.save as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(id).toBe('note-1');
    expect(title).toBe('My Note');
    expect(marks.length).toBeGreaterThan(0);
    expect(onSaved).toHaveBeenCalledWith(marks.length);
    expect(restoreView).toHaveBeenCalledWith(current);
    expect(ctrl.active()).toBe(false);
  });

  it('cancel discards without calling DraftsService.save', () => {
    const drafts = { save: vi.fn() } as unknown as DraftsService;
    const ctrl = new DraftSessionController({
      drafts,
      editor: () => fakeEditor(docOf('x')),
      currentValue: () => docOf('x'),
      entityId: () => 'n',
      entityTitle: () => '',
      restoreView: vi.fn(),
      onSaved: vi.fn(),
    });
    ctrl.start();
    ctrl.captureUpdate(docOf('y'));
    ctrl.cancel();
    expect(drafts.save).not.toHaveBeenCalled();
    expect(ctrl.active()).toBe(false);
  });

  it('captureUpdate returns false when no session is active', () => {
    const ctrl = new DraftSessionController({
      drafts: { save: vi.fn() } as unknown as DraftsService,
      editor: () => null,
      currentValue: () => docOf('x'),
      entityId: () => 'n',
      entityTitle: () => '',
      restoreView: vi.fn(),
      onSaved: vi.fn(),
    });
    expect(ctrl.captureUpdate(docOf('y'))).toBe(false);
  });
});
