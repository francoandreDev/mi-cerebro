import { describe, expect, it } from 'vitest';

import { applyOrphanFlags } from './comments-orphans';
import type { Comment } from './comments.types';

const c = (over: Partial<Comment>): Comment => ({
  id: 'c-1',
  anchorType: 'entity',
  anchor: 'e-1',
  body: { type: 'doc', content: [{ type: 'paragraph' }] },
  createdAt: '2026-06-12',
  updatedAt: '2026-06-12',
  orphaned: false,
  ...over,
});

describe('applyOrphanFlags', () => {
  it('returns the same array reference when nothing changes', () => {
    const list = [c({ anchorType: 'entity' })];
    const out = applyOrphanFlags(list, new Set(['p-1']));
    expect(out).toBe(list);
  });

  it('marks a block anchor as orphaned when its id is not in the doc', () => {
    const list = [c({ anchorType: 'block', anchor: 'gone' })];
    const out = applyOrphanFlags(list, new Set(['p-1']));
    expect(out[0]!.orphaned).toBe(true);
  });

  it('unmarks a block anchor that re-appears in the doc', () => {
    const list = [c({ anchorType: 'block', anchor: 'p-1', orphaned: true })];
    const out = applyOrphanFlags(list, new Set(['p-1']));
    expect(out[0]!.orphaned).toBe(false);
  });

  it('never marks an entity anchor as orphaned, even if a stale flag is set', () => {
    const list = [c({ anchorType: 'entity', orphaned: true })];
    const out = applyOrphanFlags(list, new Set());
    expect(out[0]!.orphaned).toBe(false);
  });

  it('preserves comments whose state already matches', () => {
    const list = [
      c({ id: 'a', anchorType: 'block', anchor: 'p-1', orphaned: false }),
      c({ id: 'b', anchorType: 'block', anchor: 'gone', orphaned: true }),
    ];
    const out = applyOrphanFlags(list, new Set(['p-1']));
    expect(out).toBe(list);
  });
});
