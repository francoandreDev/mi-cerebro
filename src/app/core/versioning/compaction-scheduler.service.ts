// §12 "Compactación del historial" — background scheduler. On workspace
// ready and every hour after, enumerates every branch of every variant
// (3 facetas × N familias), and for each one:
//   1. asks `decideCompaction` whether to run, given the persisted
//      pass-level throttle and the remote/divergence flags;
//   2. on 'run', captures the current remote-tracking oid (lease for the
//      post-rewrite force-push), builds a plan via CompactionService and
//      applies it.
//
// After any rewrite, if a remote is configured and `compactWithRemote` is
// on, force-pushes with the captured leases. A remote that advanced behind
// our back aborts the push instead of overwriting work.
//
// The pass-level throttle (1×/day per workspace) lives in
// `.mi-cerebro/compaction-state.json` so a reload doesn't reset it.
// The threshold (default 500 commits, configurable in settings) is
// per-branch so a quiet variant doesn't drag the busy one into a
// rewrite it doesn't need.

import { Injectable, computed, effect, inject, signal } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { ErrorService } from '@core/errors/error.service';
import { FsService } from '@core/fs/fs.service';
import { WorkspaceService } from '@core/fs/workspace.service';
import { SettingsService } from '@core/settings/settings.service';

import { CompactionService } from './compaction.service';
import { decideCompaction, type CompactionSchedulerDecision } from './compaction-scheduler';
import {
  EMPTY_COMPACTION_STATE,
  readCompactionState,
  writeCompactionState,
} from './compaction-state.io';
import { RemoteService } from './remote.service';
import { VariantsService } from './variants.service';
import { stripHeadsPrefix } from './variants.io';
import { VersioningService } from './versioning.service';

// why: fallback used before settings are loaded; the live threshold is
//      `SettingsService.state().versioning.compactionThresholdCommits`.
export const COMPACTION_THRESHOLD_COMMITS = 500;
const COMPACTION_THROTTLE_MS = 24 * 60 * 60 * 1000;
const COMPACTION_TICK_MS = 60 * 60 * 1000;

export interface RunOnceOptions {
  readonly ignoreThreshold?: boolean;
}

@Injectable({ providedIn: 'root' })
export class CompactionSchedulerService {
  private readonly compaction = inject(CompactionService);
  private readonly variants = inject(VariantsService);
  private readonly versioning = inject(VersioningService);
  private readonly remote = inject(RemoteService);
  private readonly settings = inject(SettingsService);
  private readonly workspace = inject(WorkspaceService);
  private readonly fs = inject(FsService);
  private readonly errors = inject(ErrorService);

  private timerHandle: ReturnType<typeof setInterval> | null = null;
  private lastRunAt: number | null = null;
  private stateLoaded = false;
  private inFlight = false;
  private divergenceReportedAt: number | null = null;

  // Updated after each pass — drives the /history banner. Tracks the
  // largest per-ref commit count we've observed so far, so the banner
  // doesn't blink when one ref crosses the threshold and others don't.
  private readonly maxBranchCommitCountSignal = signal(0);
  readonly maxBranchCommitCount = this.maxBranchCommitCountSignal.asReadonly();
  readonly threshold = computed(() => this.settings.state().versioning.compactionThresholdCommits);

  // Banner-driver. True when remote-gated would skip compaction *and*
  // some ref already deserves it. Off the rest of the time — quiet UI.
  readonly shouldSuggestEnableCompaction = computed(
    () =>
      this.remote.isConfigured() &&
      !this.settings.state().versioning.compactWithRemote &&
      this.maxBranchCommitCountSignal() > this.threshold(),
  );

  constructor() {
    // why: scheduler is registered eagerly from the app shell; the actual
    //      first pass waits until the workspace handle is authorized.
    effect(() => {
      if (this.workspace.isReady() && this.timerHandle === null) {
        void this.bootstrap();
      }
    });
  }

  start(): void {
    /* no-op: constructor effect drives the lifecycle. */
  }

  stop(): void {
    if (this.timerHandle !== null) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
    this.stateLoaded = false;
    this.lastRunAt = null;
    this.divergenceReportedAt = null;
  }

  // Exposed for the dev panel and tests. `ignoreThreshold` lets QA force
  // a pass on a workspace that hasn't crossed 500 commits yet — same gates
  // (in-flight, remote-divergence, remote-gated) still apply.
  async runOnce(options: RunOnceOptions = {}): Promise<void> {
    if (!this.stateLoaded) await this.loadState();
    await this.evaluate({ ignoreThreshold: options.ignoreThreshold ?? false });
  }

  private async bootstrap(): Promise<void> {
    await this.loadState();
    this.timerHandle = setInterval(() => void this.evaluate(), COMPACTION_TICK_MS);
    await this.evaluate();
  }

  private async loadState(): Promise<void> {
    const root = this.workspace.root();
    if (!root) return;
    try {
      const state = await readCompactionState(this.fs, root);
      this.lastRunAt = state.lastRunAt;
    } catch {
      this.lastRunAt = EMPTY_COMPACTION_STATE.lastRunAt;
    }
    this.stateLoaded = true;
  }

  private async evaluate(
    opts: { ignoreThreshold: boolean } = { ignoreThreshold: false },
  ): Promise<void> {
    if (this.inFlight) return;
    if (!this.workspace.isReady()) return;
    this.inFlight = true;
    try {
      const variants = await this.variants.list();
      const refs: string[] = [];
      for (const v of variants) {
        refs.push(stripHeadsPrefix(v.refs.main));
        refs.push(stripHeadsPrefix(v.refs.draft));
        refs.push(stripHeadsPrefix(v.refs.comments));
      }
      let anyRun = false;
      let maxCount = 0;
      const leases = new Map<string, string | null>();
      for (const ref of refs) {
        const { ran, commitCount } = await this.evaluateRef(ref, opts, leases);
        anyRun = anyRun || ran;
        if (commitCount > maxCount) maxCount = commitCount;
      }
      this.maxBranchCommitCountSignal.set(maxCount);
      if (anyRun) {
        await this.persistLastRunAt(Date.now());
        await this.pushRewrittenRefs(leases);
      }
    } finally {
      this.inFlight = false;
    }
  }

  private async evaluateRef(
    ref: string,
    opts: { ignoreThreshold: boolean },
    leases: Map<string, string | null>,
  ): Promise<{ ran: boolean; commitCount: number }> {
    let commitCount: number;
    try {
      const log = await this.versioning.logFull(ref);
      commitCount = log.length;
    } catch {
      // ref doesn't exist yet (fresh variant facet) — nothing to compact.
      return { ran: false, commitCount: 0 };
    }
    const decision = decideCompaction({
      commitCount: opts.ignoreThreshold ? Number.MAX_SAFE_INTEGER : commitCount,
      thresholdCommits: this.threshold(),
      now: Date.now(),
      lastRunAt: opts.ignoreThreshold ? null : this.lastRunAt,
      throttleMs: COMPACTION_THROTTLE_MS,
      remoteConfigured: this.remote.isConfigured(),
      compactWithRemote: this.settings.state().versioning.compactWithRemote,
      hasDivergence: this.remote.hasDivergence(),
      inFlight: false,
    });
    if (decision !== 'run') {
      this.reportSkip(decision);
      return { ran: false, commitCount };
    }
    try {
      // why: capture the lease *before* the rewrite so the post-push
      //      onPrePush check has a stable expectation. After the rewrite
      //      we can't recover the remote-tracking ref's pre-state.
      if (this.remote.isConfigured()) {
        leases.set(ref, await this.remote.snapshotRemoteOid(ref));
      }
      const plan = await this.compaction.planForBranch(ref);
      const result = await this.compaction.applyPlan(ref, plan);
      return { ran: result.rewrote, commitCount };
    } catch (cause) {
      this.errors.report(cause);
      return { ran: false, commitCount };
    }
  }

  private async pushRewrittenRefs(leases: ReadonlyMap<string, string | null>): Promise<void> {
    if (leases.size === 0) return;
    if (!this.remote.isConfigured()) return;
    if (!this.settings.state().versioning.compactWithRemote) return;
    try {
      await this.remote.pushAllWithLease(leases);
    } catch (cause) {
      // RemoteService already wrapped lease violations + partial failures
      // in AppError with NET_004; surface them through ErrorService so the
      // user sees the toast.
      this.errors.report(cause);
    }
  }

  // VER_027 is the only skip we surface, and only once per remote-divergence
  // window — otherwise the hourly tick would spam the toast. Remote-gated
  // (toggle off) is silent on purpose: the /history banner covers that case.
  private reportSkip(decision: CompactionSchedulerDecision): void {
    if (decision !== 'skip-divergent') return;
    const now = Date.now();
    if (
      this.divergenceReportedAt !== null &&
      now - this.divergenceReportedAt < COMPACTION_THROTTLE_MS
    ) {
      return;
    }
    this.divergenceReportedAt = now;
    this.errors.report(
      new AppError(ERROR_CODES.VER_027, {
        severity: 'warning',
        context: { reason: 'remote-divergence' },
        recoverable: true,
      }),
    );
  }

  private async persistLastRunAt(now: number): Promise<void> {
    this.lastRunAt = now;
    const root = this.workspace.root();
    if (!root) return;
    try {
      await writeCompactionState(this.fs, root, {
        schemaVersion: 1,
        lastRunAt: now,
      });
    } catch {
      // best-effort: workspace may be in a transient state; next pass retries.
    }
  }
}
