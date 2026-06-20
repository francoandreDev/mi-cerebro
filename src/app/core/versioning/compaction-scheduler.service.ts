// §12 "Compactación del historial" — background scheduler. On workspace
// ready and every hour after, enumerates every branch of every variant
// (3 facetas × N familias), and for each one:
//   1. asks `decideCompaction` whether to run, given the persisted
//      pass-level throttle and the remote/divergence flags;
//   2. on 'run', builds a plan via CompactionService and applies it.
//
// The pass-level throttle (1×/day per workspace) lives in
// `.mi-cerebro/compaction-state.json` so a reload doesn't reset it.
// The threshold (500 commits) is per-branch so a quiet variant doesn't
// drag the busy one into a rewrite it doesn't need.

import { Injectable, effect, inject } from '@angular/core';

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

const COMPACTION_THRESHOLD_COMMITS = 500;
const COMPACTION_THROTTLE_MS = 24 * 60 * 60 * 1000;
const COMPACTION_TICK_MS = 60 * 60 * 1000;

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

  // Exposed for the dev panel and tests. Runs once unconditionally
  // through the same gate (so it still honors in-flight + remote gates).
  async runOnce(): Promise<void> {
    if (!this.stateLoaded) await this.loadState();
    await this.evaluate();
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

  private async evaluate(): Promise<void> {
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
      for (const ref of refs) {
        const ran = await this.evaluateRef(ref);
        anyRun = anyRun || ran;
      }
      if (anyRun) await this.persistLastRunAt(Date.now());
    } finally {
      this.inFlight = false;
    }
  }

  private async evaluateRef(ref: string): Promise<boolean> {
    let commitCount: number;
    try {
      const log = await this.versioning.logFull(ref);
      commitCount = log.length;
    } catch {
      // ref doesn't exist yet (fresh variant facet) — nothing to compact.
      return false;
    }
    const decision = decideCompaction({
      commitCount,
      thresholdCommits: COMPACTION_THRESHOLD_COMMITS,
      now: Date.now(),
      lastRunAt: this.lastRunAt,
      throttleMs: COMPACTION_THROTTLE_MS,
      remoteConfigured: this.remote.isConfigured(),
      compactWithRemote: this.settings.state().versioning.compactWithRemote,
      hasDivergence: this.remote.hasDivergence(),
      inFlight: false,
    });
    if (decision !== 'run') {
      this.reportSkip(decision);
      return false;
    }
    try {
      const plan = await this.compaction.planForBranch(ref);
      const result = await this.compaction.applyPlan(ref, plan);
      return result.rewrote;
    } catch (cause) {
      this.errors.report(cause);
      return false;
    }
  }

  // VER_027 is the only skip we surface, and only once per remote-divergence
  // window — otherwise the hourly tick would spam the toast. Remote-gated
  // (toggle off) is silent on purpose: the banner in /history is session 4.
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
