// §12 "Compactación del historial" — scheduler decision matrix. Pure;
// the async wrapper (CompactionSchedulerService) is integration. Order
// of skip rules matters: in-flight wins (would race the running pass),
// then remote gates (we never even build a plan when the toggle blocks),
// then threshold, then throttle.

import { describe, expect, it } from 'vitest';

import { decideCompaction, type CompactionSchedulerInput } from './compaction-scheduler';

const DAY = 24 * 60 * 60 * 1000;

const base: CompactionSchedulerInput = {
  commitCount: 600,
  thresholdCommits: 500,
  now: 10_000_000,
  lastRunAt: null,
  throttleMs: DAY,
  remoteConfigured: false,
  compactWithRemote: false,
  hasDivergence: false,
  inFlight: false,
};

describe('decideCompaction', () => {
  it('runs when above threshold and no throttle', () => {
    expect(decideCompaction(base)).toBe('run');
  });

  it('skips below threshold', () => {
    expect(decideCompaction({ ...base, commitCount: 499 })).toBe('skip-below-threshold');
  });

  it('skips inside throttle window', () => {
    const lastRunAt = base.now - (DAY - 1);
    expect(decideCompaction({ ...base, lastRunAt })).toBe('skip-throttle');
  });

  it('runs once throttle window elapsed', () => {
    const lastRunAt = base.now - DAY;
    expect(decideCompaction({ ...base, lastRunAt })).toBe('run');
  });

  it('skips when a pass is in flight', () => {
    expect(decideCompaction({ ...base, inFlight: true })).toBe('skip-in-flight');
  });

  it('skips when remote configured and compactWithRemote toggle off', () => {
    expect(decideCompaction({ ...base, remoteConfigured: true })).toBe('skip-remote-gated');
  });

  it('runs when remote configured and compactWithRemote toggle on', () => {
    expect(decideCompaction({ ...base, remoteConfigured: true, compactWithRemote: true })).toBe(
      'run',
    );
  });

  it('skips when remote diverged even with toggle on', () => {
    expect(
      decideCompaction({
        ...base,
        remoteConfigured: true,
        compactWithRemote: true,
        hasDivergence: true,
      }),
    ).toBe('skip-divergent');
  });

  it('ignores divergence when no remote is configured', () => {
    expect(decideCompaction({ ...base, hasDivergence: true })).toBe('run');
  });

  it('in-flight outranks every other skip', () => {
    expect(
      decideCompaction({
        ...base,
        inFlight: true,
        remoteConfigured: true,
        hasDivergence: true,
        commitCount: 0,
      }),
    ).toBe('skip-in-flight');
  });

  it('remote-gated outranks threshold and throttle', () => {
    expect(
      decideCompaction({
        ...base,
        remoteConfigured: true,
        commitCount: 0,
        lastRunAt: base.now,
      }),
    ).toBe('skip-remote-gated');
  });

  it('treats negative throttle as zero (immediate run allowed)', () => {
    expect(decideCompaction({ ...base, throttleMs: -1, lastRunAt: base.now - 1 })).toBe('run');
  });
});
