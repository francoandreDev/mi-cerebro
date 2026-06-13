// 13e-iii — classifyTip cases. Keeps the integration (git.isDescendent
// + git.resolveRef) out of scope; that pairing is covered by the manual
// gate at the end of 13e.

import { describe, expect, it } from 'vitest';

import { classifyTip } from './remote-divergence';

describe('classifyTip', () => {
  it('returns absent when remote tip is unknown', () => {
    expect(classifyTip('a', null, false, false)).toBe('absent');
  });

  it('returns fast-forward when local is missing but remote exists', () => {
    expect(classifyTip(null, 'r', false, false)).toBe('fast-forward');
  });

  it('returns identical when both tips equal', () => {
    expect(classifyTip('same', 'same', false, false)).toBe('identical');
  });

  it('returns fast-forward when local is ancestor of remote only', () => {
    expect(classifyTip('l', 'r', true, false)).toBe('fast-forward');
  });

  it('returns ahead when remote is ancestor of local only', () => {
    expect(classifyTip('l', 'r', false, true)).toBe('ahead');
  });

  it('returns divergent when neither side is ancestor of the other', () => {
    expect(classifyTip('l', 'r', false, false)).toBe('divergent');
  });

  it('prefers ahead over fast-forward when both ancestor checks claim true', () => {
    // why: degenerate case if the user merged in a circle; ahead is the
    //      safer label since push is the no-op.
    expect(classifyTip('l', 'r', true, true)).toBe('ahead');
  });
});
