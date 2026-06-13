// 13e-iv — scheduler decision matrix. Three pillars: opt-in toggle,
// throttle window, and the safety gates (divergence / in-flight /
// configured). The async wrapper (AutoPushService) is integration —
// here we keep it pure.

import { describe, expect, it } from 'vitest';

import { decideAutoPush, type SchedulerInput } from './auto-push-scheduler';

const base: SchedulerInput = {
  enabled: true,
  configured: true,
  throttleMinutes: 5,
  now: 10_000_000,
  lastPushAt: null,
  hasDivergence: false,
  inFlight: false,
};

describe('decideAutoPush', () => {
  it('returns skip-disabled when toggle is off', () => {
    expect(decideAutoPush({ ...base, enabled: false })).toBe('skip-disabled');
  });

  it('returns skip-not-configured when there is no remote', () => {
    expect(decideAutoPush({ ...base, configured: false })).toBe('skip-not-configured');
  });

  it('returns skip-divergent when divergence is pending', () => {
    expect(decideAutoPush({ ...base, hasDivergence: true })).toBe('skip-divergent');
  });

  it('returns skip-in-flight when a push is already running', () => {
    expect(decideAutoPush({ ...base, inFlight: true })).toBe('skip-in-flight');
  });

  it('pushes on first run when lastPushAt is null', () => {
    expect(decideAutoPush({ ...base, lastPushAt: null })).toBe('push');
  });

  it('skips when inside the throttle window', () => {
    const lastPushAt = base.now - 4 * 60 * 1000;
    expect(decideAutoPush({ ...base, lastPushAt })).toBe('skip-throttle');
  });

  it('pushes once the throttle window elapsed', () => {
    const lastPushAt = base.now - 5 * 60 * 1000;
    expect(decideAutoPush({ ...base, lastPushAt })).toBe('push');
  });

  it('treats negative throttle as zero (immediate push allowed)', () => {
    expect(decideAutoPush({ ...base, throttleMinutes: -1, lastPushAt: base.now - 1000 })).toBe(
      'push',
    );
  });

  it('prefers divergence over throttle in the skip order', () => {
    const lastPushAt = base.now - 1000;
    expect(decideAutoPush({ ...base, lastPushAt, hasDivergence: true })).toBe('skip-divergent');
  });
});
