// 13f — Spec for EditorCommentsCoordinator. Stubs CommentsService and
// asserts that the popover state machine + persistence flow work end
// to end: openNew → setBody → save persists; openExisting → remove
// drops the row and pushes clouds.

import { describe, expect, it, vi } from 'vitest';

import type { CommentsService } from '@core/versioning/comments.service';
import type { Comment, CommentsFile } from '@core/versioning/comments.types';

import { EditorCommentsCoordinator } from './editor-comments.coordinator';

const fakeService = (initial: readonly Comment[]) => {
  const calls = { save: vi.fn().mockResolvedValue(undefined) };
  const svc = {
    read: vi.fn().mockResolvedValue({
      schemaVersion: 1,
      entityId: 'e-1',
      comments: initial,
    } satisfies CommentsFile),
    save: calls.save,
  } as unknown as CommentsService;
  return { svc, calls };
};

const ctxOf = (svc: CommentsService, pushClouds = vi.fn()) =>
  ({
    comments: svc,
    entityId: () => 'e-1',
    entityTitle: () => 'Entity',
    pushClouds,
    t: (key: string) => key,
  }) as const;

const sample = (over: Partial<Comment> = {}): Comment => ({
  id: 'c-1',
  anchorType: 'block',
  anchor: 'b-1',
  body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }] },
  createdAt: '2026-06-14',
  updatedAt: '2026-06-14',
  orphaned: false,
  ...over,
});

describe('EditorCommentsCoordinator', () => {
  it('openNew → setBody → save appends a new comment and pushes clouds', async () => {
    const { svc, calls } = fakeService([]);
    const pushClouds = vi.fn();
    const coord = new EditorCommentsCoordinator(ctxOf(svc, pushClouds));
    await coord.loadFor('e-1');

    coord.openNew('b-1', { top: 0, left: 0 });
    coord.setBody('hola');
    await coord.save();

    expect(calls.save).toHaveBeenCalledTimes(1);
    const next = calls.save.mock.calls[0]![2] as readonly Comment[];
    expect(next.length).toBe(1);
    expect(next[0]!.anchorType).toBe('block');
    expect(next[0]!.anchor).toBe('b-1');
    expect(coord.popover()).toBeNull();
    expect(pushClouds).toHaveBeenLastCalledWith(next);
  });

  it('save with empty body sets an error and does not persist', async () => {
    const { svc, calls } = fakeService([]);
    const coord = new EditorCommentsCoordinator(ctxOf(svc));
    await coord.loadFor('e-1');

    coord.openNew(null, { top: 0, left: 0 });
    await coord.save();

    expect(calls.save).not.toHaveBeenCalled();
    expect(coord.popover()?.error.length).toBeGreaterThan(0);
  });

  it('openExisting → remove drops the row and updates the list', async () => {
    const existing = sample({ id: 'c-1' });
    const { svc, calls } = fakeService([existing]);
    const coord = new EditorCommentsCoordinator(ctxOf(svc));
    await coord.loadFor('e-1');

    coord.openExisting('c-1', { top: 0, left: 0 });
    expect(coord.popover()?.mode).toBe('edit');
    await coord.remove();

    expect(calls.save).toHaveBeenCalledTimes(1);
    expect((calls.save.mock.calls[0]![2] as readonly Comment[]).length).toBe(0);
    expect(coord.list().length).toBe(0);
    expect(coord.popover()).toBeNull();
  });

  it('dismiss clears the popover without touching the list', async () => {
    const { svc } = fakeService([sample()]);
    const coord = new EditorCommentsCoordinator(ctxOf(svc));
    await coord.loadFor('e-1');
    coord.openExisting('c-1', { top: 0, left: 0 });
    coord.dismiss();
    expect(coord.popover()).toBeNull();
    expect(coord.list().length).toBe(1);
  });
});
