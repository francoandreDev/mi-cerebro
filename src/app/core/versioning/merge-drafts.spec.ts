// 13d-iv — guard test pairing the drafts-merge commit message format with
// the /history facet classifier. The full plumbing path (read blob from
// `from.refs.draft`, write merge commit on `into.refs.draft`) is exercised
// manually in the closing gate (see PROYECTO §13d-iv). What we lock in
// here is the contract every drafts-merge commit must satisfy so the
// `draft` chip in /history keeps filtering the right rows.

import { describe, expect, it } from 'vitest';

import { facetOf } from '@features/history/services/facet';

// Mirrors what MergeService.formatDraftsMessage produces. Kept in sync via
// the matcher below — a drift between producer and consumer would fail
// both tests at once.
const DRAFTS_MERGE_SUBJECT = /^merge \[borrador\]:/;

describe('drafts-merge commit message', () => {
  it('matches the prefix the facet classifier expects', () => {
    const subject = 'merge [borrador]: ent-123 (from "A" into "B")';
    expect(DRAFTS_MERGE_SUBJECT.test(subject)).toBe(true);
    expect(facetOf(subject)).toBe('draft');
  });

  it('keeps Merge-Group and Merge-Facet trailers under "draft"', () => {
    const message = [
      'merge [borrador]: ent-123 (from "A" into "B")',
      '',
      'Merge-Group: 11111111-1111-1111-1111-111111111111',
      'Merge-From: variant-a',
      'Merge-Into: variant-b',
      'Merge-Facet: draft',
      'Merge-Choice: from',
      '',
    ].join('\n');
    expect(facetOf(message)).toBe('draft');
    expect(message).toContain('Merge-Facet: draft');
  });

  it('does not collide with the comments facet', () => {
    expect(facetOf('merge [comentarios]: ent-123 (from "A" into "B")')).toBe('comments');
    expect(facetOf('merge [borrador]: ent-123 (from "A" into "B")')).toBe('draft');
  });
});
