// 13e-iv — pure decision helper for AutoPushService. Given the current
// state (toggle + throttle + remote/divergence flags + clocks), returns
// what the service should do. Kept side-effect-free so the unit spec
// can cover throttle edges without faking timers.

export type SchedulerDecision =
  | 'push'
  | 'skip-disabled'
  | 'skip-throttle'
  | 'skip-divergent'
  | 'skip-in-flight'
  | 'skip-not-configured';

export interface SchedulerInput {
  readonly enabled: boolean;
  readonly configured: boolean;
  readonly throttleMinutes: number;
  readonly now: number;
  readonly lastPushAt: number | null;
  readonly hasDivergence: boolean;
  readonly inFlight: boolean;
}

export function decideAutoPush(input: SchedulerInput): SchedulerDecision {
  if (!input.enabled) return 'skip-disabled';
  if (!input.configured) return 'skip-not-configured';
  if (input.hasDivergence) return 'skip-divergent';
  if (input.inFlight) return 'skip-in-flight';
  if (input.lastPushAt !== null) {
    const windowMs = Math.max(0, input.throttleMinutes) * 60 * 1000;
    if (input.now - input.lastPushAt < windowMs) return 'skip-throttle';
  }
  return 'push';
}
