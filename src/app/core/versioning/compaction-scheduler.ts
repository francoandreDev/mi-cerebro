// §12 "Compactación del historial" — pure decision helper for the
// background scheduler. Given workspace state (threshold + throttle +
// remote/divergence flags + clocks) per ref, returns what the scheduler
// should do for that ref. Side-effect-free so the spec can cover throttle
// and threshold edges without faking timers.

export type CompactionSchedulerDecision =
  | 'run'
  | 'skip-below-threshold'
  | 'skip-throttle'
  | 'skip-in-flight'
  | 'skip-remote-gated'
  | 'skip-divergent';

export interface CompactionSchedulerInput {
  readonly commitCount: number;
  readonly thresholdCommits: number;
  readonly now: number;
  readonly lastRunAt: number | null;
  readonly throttleMs: number;
  readonly remoteConfigured: boolean;
  readonly compactWithRemote: boolean;
  readonly hasDivergence: boolean;
  readonly inFlight: boolean;
}

export function decideCompaction(input: CompactionSchedulerInput): CompactionSchedulerDecision {
  if (input.inFlight) return 'skip-in-flight';
  if (input.remoteConfigured && !input.compactWithRemote) return 'skip-remote-gated';
  if (input.remoteConfigured && input.compactWithRemote && input.hasDivergence) {
    return 'skip-divergent';
  }
  if (input.commitCount < input.thresholdCommits) return 'skip-below-threshold';
  if (input.lastRunAt !== null) {
    const window = Math.max(0, input.throttleMs);
    if (input.now - input.lastRunAt < window) return 'skip-throttle';
  }
  return 'run';
}
