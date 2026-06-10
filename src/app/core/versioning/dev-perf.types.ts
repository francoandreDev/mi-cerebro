// Public types for DevPerfService. Kept in a separate file so the
// service stays within the project's max-lines limit.

import type { Caso7Detail } from './dev-perf.casos';

export type CaseStatus = 'pass' | 'fail';

export interface CaseResult {
  readonly id: string;
  readonly name: string;
  readonly status: CaseStatus;
  readonly durationMs: number;
  readonly detail?: string;
}

export interface ProgressState {
  readonly phase: 'idle' | 'cleanup-start' | 'running' | 'cleanup-end' | 'done';
  readonly currentId: string | null;
  readonly currentName: string | null;
  readonly currentStartMs: number;
  readonly completed: number;
  readonly total: number;
}

export interface PerfReport {
  readonly cases: readonly CaseResult[];
  readonly caso7?: Caso7Detail;
  readonly verdict: 'viable' | 'fallback' | 'partial';
  readonly thresholds: {
    readonly commitAllMs: number;
    readonly logMs: number;
  };
}
