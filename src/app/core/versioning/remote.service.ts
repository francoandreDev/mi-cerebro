// 13e-i — Remote service for the GitHub bridge. Owns the in-memory copy
// of `.mi-cerebro/secrets.json` (config + lastPushAt) plus push/fetch
// operations. Network calls only fire from explicit user actions
// (`/settings` Save/Push, `/sync` Push todo/Fetch todo) — regla §4.14.
// 13e-ii — pushAll/fetchAll: iterate variants × {main, comments, draft}.

import { Injectable, computed, effect, inject, signal } from '@angular/core';
import * as git from 'isomorphic-git';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { FsLockService } from '@core/fs/fs-lock.service';
import { FsService } from '@core/fs/fs.service';
import { WorkspaceService } from '@core/fs/workspace.service';
import { IdbService } from '@core/idb/idb.service';

import { GitFsAdapter } from './git-fs.adapter';
import { OpfsGitRootService } from './opfs-git-root';
import {
  type ConfigFs,
  ensureGitignoredSecrets,
  isValidProxyUrl,
  isValidRemoteUrl,
  readRemoteSecrets,
  writeRemoteSecrets,
} from './remote.config.io';
import {
  ensureRemoteConfigured,
  gitFetchOne,
  gitPushOne,
  gitPushWithLeaseOne,
  listRefTargets,
  remoteTrackingRef,
  runBulk,
  summarize,
} from './remote-bulk';
import { detectDivergences, type DivergentRef } from './remote-divergence';
import {
  REMOTE_SECRETS_SCHEMA_VERSION,
  emptyRemoteSecrets,
  localDateKey,
  type BulkSyncResult,
  type DispatchCount,
  type PushOutcome,
  type RefSyncOutcome,
  type RemoteConfig,
  type RemoteSecretsFile,
} from './remote.types';
import { SyncWhistleService } from './sync-whistle.service';
import { VariantsService } from './variants.service';
import { stripHeadsPrefix } from './variants.io';

const TEXT_ENCODER = new TextEncoder();

@Injectable({ providedIn: 'root' })
export class RemoteService {
  private readonly workspace = inject(WorkspaceService);
  private readonly variants = inject(VariantsService);
  private readonly fsLock = inject(FsLockService);
  private readonly fs = inject(FsService);
  private readonly opfsGitRoot = inject(OpfsGitRootService);
  private readonly whistle = inject(SyncWhistleService);
  private readonly idb = inject(IdbService);

  private readonly stateSignal = signal<RemoteSecretsFile>(emptyRemoteSecrets());
  private readonly pushingSignal = signal(false);
  private readonly fetchingSignal = signal(false);
  private readonly lastPushOutcomesSignal = signal<readonly RefSyncOutcome[] | null>(null);
  private readonly lastFetchOutcomesSignal = signal<readonly RefSyncOutcome[] | null>(null);
  private readonly lastBulkAtSignal = signal<string | null>(null);
  private readonly divergentRefsSignal = signal<readonly DivergentRef[]>([]);
  private fileSynced = false;

  readonly config = computed(() => this.stateSignal().remote);
  readonly lastPushAt = computed(() => this.stateSignal().lastPushAt ?? null);
  readonly isPushing = this.pushingSignal.asReadonly();
  readonly isFetching = this.fetchingSignal.asReadonly();
  readonly isConfigured = computed(() => this.stateSignal().remote !== null);
  readonly lastPushOutcomes = this.lastPushOutcomesSignal.asReadonly();
  readonly lastFetchOutcomes = this.lastFetchOutcomesSignal.asReadonly();
  readonly lastBulkAt = this.lastBulkAtSignal.asReadonly();
  readonly dispatchCount = computed(() => this.stateSignal().dispatchCount ?? null);
  readonly divergentRefs = this.divergentRefsSignal.asReadonly();
  readonly hasDivergence = computed(() => this.divergentRefsSignal().length > 0);

  clearDivergence(): void {
    this.divergentRefsSignal.set([]);
  }

  constructor() {
    effect(() => {
      if (this.workspace.isReady() && !this.fileSynced) {
        this.fileSynced = true;
        void this.loadFromDisk();
      }
    });
  }

  async configure(input: RemoteConfig): Promise<void> {
    const url = input.url.trim();
    const token = input.token.trim();
    const corsProxyUrl = input.corsProxyUrl?.trim();
    if (!isValidRemoteUrl(url) || token.length === 0) {
      throw new AppError(ERROR_CODES.NET_001, {
        severity: 'error',
        context: { reason: 'invalid-config' },
        recoverable: true,
      });
    }
    if (corsProxyUrl && !isValidProxyUrl(corsProxyUrl)) {
      throw new AppError(ERROR_CODES.NET_001, {
        severity: 'error',
        context: { reason: 'invalid-proxy-url' },
        recoverable: true,
      });
    }
    const fs = await this.requireConfigFs();
    await ensureGitignoredSecrets(fs);
    const next: RemoteSecretsFile = {
      schemaVersion: REMOTE_SECRETS_SCHEMA_VERSION,
      remote: { url, token, ...(corsProxyUrl ? { corsProxyUrl } : {}) },
      ...(this.stateSignal().lastPushAt ? { lastPushAt: this.stateSignal().lastPushAt! } : {}),
    };
    await writeRemoteSecrets(fs, this.idb, next);
    this.stateSignal.set(next);
  }

  async clear(): Promise<void> {
    const fs = await this.requireConfigFs();
    const next = emptyRemoteSecrets();
    await writeRemoteSecrets(fs, this.idb, next);
    this.stateSignal.set(next);
  }

  // 13e-i — manual push of the active variant's main only. Errors map
  // to NET_002 (auth) / NET_003 (other) via classifyPushError.
  async pushActiveMain(): Promise<PushOutcome> {
    const cfg = this.requireConfigured();
    const active = this.variants.getActive();
    if (!active) {
      throw new AppError(ERROR_CODES.NET_001, {
        severity: 'error',
        context: { reason: 'no-active-variant' },
        recoverable: true,
      });
    }
    const ref = stripHeadsPrefix(active.refs.main);
    return this.fsLock.withLock(() => this.runSinglePush(cfg, ref));
  }

  async pushAll(): Promise<BulkSyncResult> {
    const cfg = this.requireConfigured();
    if (this.divergentRefsSignal().length > 0) {
      throw new AppError(ERROR_CODES.NET_006, {
        severity: 'error',
        context: { reason: 'divergence-pending', refs: this.divergentRefsSignal() },
        recoverable: true,
      });
    }
    const variants = await this.variants.list();
    const targets = listRefTargets(variants);
    return this.fsLock.withLock(async () => {
      this.pushingSignal.set(true);
      try {
        const adapter = await this.requireGitFs();
        const outcomes = await runBulk(targets, gitPushOne(adapter, cfg));
        this.lastPushOutcomesSignal.set(outcomes);
        this.lastBulkAtSignal.set(new Date().toISOString());
        await this.persistLastPushAt();
        return this.finalizeBulk(outcomes, ERROR_CODES.NET_004);
      } finally {
        this.pushingSignal.set(false);
      }
    });
  }

  // §12 — captures the current remote-tracking oid for `ref` so callers
  // (compaction scheduler) can later use it as a lease for force-push.
  // Null when no tracking ref exists yet (ref never been fetched / pushed).
  async snapshotRemoteOid(ref: string): Promise<string | null> {
    if (!this.workspace.isReady()) return null;
    try {
      const adapter = await this.requireGitFs();
      return await git.resolveRef({
        fs: adapter,
        dir: '/',
        ref: remoteTrackingRef(ref),
      });
    } catch {
      return null;
    }
  }

  // §12 — variant of pushAll() that force-pushes each ref with the lease
  // captured in `leases`. Used by the compaction scheduler after a rewrite:
  // without `force`, GitHub rejects the diverged history; with the lease,
  // a remote that advanced behind our back aborts the push instead of
  // overwriting work. Refs not in `leases` get a regular (non-force) push.
  async pushAllWithLease(leases: ReadonlyMap<string, string | null>): Promise<BulkSyncResult> {
    const cfg = this.requireConfigured();
    const variants = await this.variants.list();
    const targets = listRefTargets(variants);
    return this.fsLock.withLock(async () => {
      this.pushingSignal.set(true);
      try {
        const adapter = await this.requireGitFs();
        const outcomes: RefSyncOutcome[] = [];
        for (const t of targets) {
          const fn = leases.has(t.ref)
            ? gitPushWithLeaseOne(adapter, cfg, leases.get(t.ref) ?? null)
            : gitPushOne(adapter, cfg);
          const r = await fn(t.ref);
          outcomes.push({
            variantId: t.variantId,
            facet: t.facet,
            ref: t.ref,
            remoteRef: t.ref,
            status: r.status,
            ...(r.error ? { error: r.error } : {}),
          });
        }
        this.lastPushOutcomesSignal.set(outcomes);
        this.lastBulkAtSignal.set(new Date().toISOString());
        await this.persistLastPushAt();
        return this.finalizeBulk(outcomes, ERROR_CODES.NET_004);
      } finally {
        this.pushingSignal.set(false);
      }
    });
  }

  async fetchAll(): Promise<BulkSyncResult> {
    const cfg = this.requireConfigured();
    const variants = await this.variants.list();
    const targets = listRefTargets(variants);
    return this.fsLock.withLock(async () => {
      this.fetchingSignal.set(true);
      try {
        const adapter = await this.requireGitFs();
        await ensureRemoteConfigured(adapter, cfg.url);
        const outcomes = await runBulk(targets, gitFetchOne(adapter, cfg));
        this.lastFetchOutcomesSignal.set(outcomes);
        this.lastBulkAtSignal.set(new Date().toISOString());
        const divergent = await detectDivergences(adapter, outcomes);
        this.divergentRefsSignal.set(divergent);
        const result = this.finalizeBulk(outcomes, ERROR_CODES.NET_005);
        if (divergent.length > 0) {
          throw new AppError(ERROR_CODES.NET_006, {
            severity: 'error',
            context: { refs: divergent },
            recoverable: true,
          });
        }
        return result;
      } finally {
        this.fetchingSignal.set(false);
      }
    });
  }

  private finalizeBulk(
    outcomes: readonly RefSyncOutcome[],
    partialCode: typeof ERROR_CODES.NET_004 | typeof ERROR_CODES.NET_005,
  ): BulkSyncResult {
    const { errorCount, successCount } = summarize(outcomes);
    const result: BulkSyncResult = { outcomes, errorCount, successCount };
    if (errorCount === 0) return result;
    const errored = outcomes.filter((o) => o.status === 'error');
    throw new AppError(partialCode, {
      severity: 'error',
      context: {
        total: outcomes.length,
        errorCount,
        successCount,
        refs: errored.map((o) => ({ ref: o.ref, error: o.error })),
      },
      recoverable: true,
    });
  }

  private requireConfigured(): RemoteConfig {
    const cfg = this.config();
    if (!cfg) {
      throw new AppError(ERROR_CODES.NET_001, {
        severity: 'error',
        context: { reason: 'not-configured' },
        recoverable: true,
      });
    }
    return cfg;
  }

  private async runSinglePush(cfg: RemoteConfig, ref: string): Promise<PushOutcome> {
    this.pushingSignal.set(true);
    try {
      const adapter = await this.requireGitFs();
      const result = await gitPushOne(adapter, cfg)(ref);
      if (result.status === 'error') {
        throw this.classifyPushError(result.error ?? '', ref);
      }
      await this.persistLastPushAt();
      const status = result.status === 'absent' ? 'ok' : result.status;
      return { ref, status, remoteRef: ref };
    } finally {
      this.pushingSignal.set(false);
    }
  }

  private classifyPushError(message: string, ref: string): AppError {
    const isAuth = /401|403|unauthor|forbid|authentication/i.test(message);
    return new AppError(isAuth ? ERROR_CODES.NET_002 : ERROR_CODES.NET_003, {
      severity: 'error',
      context: { ref, message },
      recoverable: true,
    });
  }

  private async persistLastPushAt(): Promise<void> {
    const fs = await this.requireConfigFs();
    const next: RemoteSecretsFile = {
      ...this.stateSignal(),
      lastPushAt: new Date().toISOString(),
      dispatchCount: bumpDispatchCount(this.stateSignal().dispatchCount),
    };
    await writeRemoteSecrets(fs, this.idb, next);
    this.stateSignal.set(next);
    this.whistle.play();
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const fs = await this.requireConfigFs();
      const { file, migrated } = await readRemoteSecrets(fs, this.idb);
      this.stateSignal.set(file);
      // why: a v1 (plaintext-token) file was upgraded in memory — persist
      //      it encrypted right away instead of leaving it in plaintext
      //      on disk until some unrelated future write.
      if (migrated) await writeRemoteSecrets(fs, this.idb, file);
    } catch {
      // workspace not ready, keep default state — effect will retry.
    }
  }

  private async requireGitFs(): Promise<GitFsAdapter> {
    const root = this.workspace.root();
    if (!root) {
      throw new AppError(ERROR_CODES.NET_001, {
        severity: 'error',
        context: { reason: 'workspace-not-ready' },
        recoverable: true,
      });
    }
    const gitDirRoot = await this.opfsGitRoot.getGitDir();
    return new GitFsAdapter(root, this.fs, gitDirRoot);
  }

  private async requireConfigFs(): Promise<ConfigFs> {
    const adapter = await this.requireGitFs();
    return {
      readFile: async (path) => {
        const data = await adapter.readFile(path);
        return typeof data === 'string' ? TEXT_ENCODER.encode(data) : data;
      },
      writeFile: (path, content) => adapter.writeFile(path, content),
    };
  }
}

function bumpDispatchCount(prev: DispatchCount | undefined): DispatchCount {
  const today = localDateKey(new Date());
  if (prev?.date === today) return { date: today, count: prev.count + 1 };
  return { date: today, count: 1 };
}
