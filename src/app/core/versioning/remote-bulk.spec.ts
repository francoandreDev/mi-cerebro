// 13e-ii — bulk push / fetch orchestration tests. The `runBulk` helper
// is the unit we care about: given a list of targets and a stub
// `syncOne`, it iterates and produces the right shape. Real network
// classification is covered by integration in 13e-i + manual gate.

import { describe, expect, it } from 'vitest';

import {
  classifyPushResult,
  listRefTargets,
  remoteTrackingRef,
  runBulk,
  summarize,
  type SyncOneFn,
} from './remote-bulk';
import type { RefSyncStatus } from './remote.types';
import { type Variant } from './variants.types';

const variant = (id: string, refs: { main: string; comments: string; draft: string }): Variant => ({
  id,
  name: id,
  color: '#000',
  protected: id === 'principal',
  lastActivityAt: 0,
  state: 'active',
  refs,
  parentId: id === 'principal' ? null : 'principal',
  forkOid: null,
});

describe('listRefTargets', () => {
  it('emits 3 targets per variant in {main, comments, draft} order', () => {
    const principal = variant('principal', {
      main: 'main',
      comments: 'variant/principal/comments',
      draft: 'variant/principal/draft',
    });
    const beta = variant('beta', {
      main: 'variant/beta/main',
      comments: 'variant/beta/comments',
      draft: 'variant/beta/draft',
    });
    const targets = listRefTargets([principal, beta]);
    expect(targets).toHaveLength(6);
    expect(targets.map((t) => `${t.variantId}/${t.facet}`)).toEqual([
      'principal/main',
      'principal/comments',
      'principal/draft',
      'beta/main',
      'beta/comments',
      'beta/draft',
    ]);
    expect(targets[0]?.ref).toBe('main');
    expect(targets[3]?.ref).toBe('variant/beta/main');
  });

  it('strips refs/heads/ prefixes when present', () => {
    const v = variant('x', {
      main: 'refs/heads/main',
      comments: 'variant/x/comments',
      draft: 'variant/x/draft',
    });
    expect(listRefTargets([v])[0]?.ref).toBe('main');
  });
});

describe('remoteTrackingRef', () => {
  it('maps to refs/remotes/origin/<ref>', () => {
    expect(remoteTrackingRef('main')).toBe('refs/remotes/origin/main');
    expect(remoteTrackingRef('variant/beta/draft')).toBe('refs/remotes/origin/variant/beta/draft');
  });
});

describe('runBulk', () => {
  const targets = listRefTargets([
    variant('a', { main: 'variant/a/main', comments: 'variant/a/c', draft: 'variant/a/d' }),
  ]);

  it('reports ok for every target when syncOne always succeeds', async () => {
    const out = await runBulk(targets, async () => ({ status: 'ok' }));
    expect(out).toHaveLength(3);
    expect(out.map((o) => o.status)).toEqual(['ok', 'ok', 'ok']);
    expect(out[0]).toMatchObject({
      variantId: 'a',
      facet: 'main',
      ref: 'variant/a/main',
      remoteRef: 'variant/a/main',
      status: 'ok',
    });
  });

  it('preserves per-ref errors with their message', async () => {
    const syncOne: SyncOneFn = async (ref) =>
      ref === 'variant/a/c' ? { status: 'error', error: 'boom' } : { status: 'up-to-date' };
    const out = await runBulk(targets, syncOne);
    expect(out.map((o) => o.status)).toEqual(['up-to-date', 'error', 'up-to-date']);
    expect(out[1]?.error).toBe('boom');
  });

  it('calls syncOne sequentially (one in flight at a time)', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const syncOne: SyncOneFn = async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
      return { status: 'ok' };
    };
    await runBulk(targets, syncOne);
    expect(maxInFlight).toBe(1);
  });
});

describe('classifyPushResult', () => {
  // why: isomorphic-git's PushResult never sets `.error` on success — it's
  //      `undefined`, not `null` — and keys `.refs` by the full
  //      `refs/heads/<ref>` name the server echoes back, not the short name
  //      passed as `ref`/`remoteRef`. A real MCB-NET-004 incident showed
  //      pushAll marking every successful ref as `unknown` error because of
  //      this mismatch — this locks in the fix against both regressions.
  it('classifies a successful push as ok, not error', () => {
    const result = {
      ok: true,
      refs: { 'refs/heads/variant/nueva/main': { ok: true, error: '' } },
    };
    expect(classifyPushResult(result, 'variant/nueva/main')).toEqual({ status: 'ok' });
  });

  it('classifies an up-to-date push using the full-ref-keyed entry', () => {
    const result = {
      ok: true,
      refs: { 'refs/heads/main': { ok: true, error: 'up to date' } },
    };
    expect(classifyPushResult(result, 'main').status).toBe('up-to-date');
  });

  it('surfaces a real per-ref rejection message', () => {
    const result = {
      ok: true,
      refs: { 'refs/heads/main': { ok: false, error: 'non-fast-forward' } },
    };
    expect(classifyPushResult(result, 'main')).toEqual({
      status: 'error',
      error: 'non-fast-forward',
    });
  });

  it('classifies a top-level unpack failure as error with its message', () => {
    const result = { ok: false, error: 'index-pack failed' };
    expect(classifyPushResult(result, 'main')).toEqual({
      status: 'error',
      error: 'index-pack failed',
    });
  });
});

describe('summarize', () => {
  const o = (status: RefSyncStatus) => ({
    variantId: 'x',
    facet: 'main' as const,
    ref: 'r',
    remoteRef: 'r',
    status,
  });

  it('counts errors vs successes (up-to-date / absent count as success)', () => {
    const s = summarize([o('ok'), o('up-to-date'), o('absent'), o('error'), o('error')]);
    expect(s).toEqual({ errorCount: 2, successCount: 3 });
  });

  it('handles empty input', () => {
    expect(summarize([])).toEqual({ errorCount: 0, successCount: 0 });
  });
});
