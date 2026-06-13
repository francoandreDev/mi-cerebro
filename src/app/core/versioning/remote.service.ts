// 13e-i — Remote service for the GitHub bridge. Owns the in-memory copy
// of `.mi-cerebro/secrets.json` (config + lastPushAt) plus the push
// operation. Network calls only fire from explicit user actions
// (`/settings` Save / Push buttons) — regla §4.14.

import { Injectable, computed, effect, inject, signal } from '@angular/core';
import * as git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { FsLockService } from '@core/fs/fs-lock.service';
import { WorkspaceService } from '@core/fs/workspace.service';

import { GitFsAdapter } from './git-fs.adapter';
import {
  type ConfigFs,
  ensureGitignoredSecrets,
  isValidRemoteUrl,
  readRemoteSecrets,
  writeRemoteSecrets,
} from './remote.config.io';
import {
  REMOTE_SECRETS_SCHEMA_VERSION,
  emptyRemoteSecrets,
  type PushOutcome,
  type RemoteConfig,
  type RemoteSecretsFile,
} from './remote.types';
import { VariantsService } from './variants.service';
import { stripHeadsPrefix } from './variants.io';

const REPO_DIR = '/';
const CORS_PROXY = 'https://cors.isomorphic-git.org';
const TEXT_ENCODER = new TextEncoder();

const isUpToDateError = (msg: string | null | undefined): boolean =>
  typeof msg === 'string' && /up.?to.?date|up to date/i.test(msg);

type ClassifiedPush =
  | { kind: 'ok'; status: PushOutcome['status'] }
  | { kind: 'error'; message: string };

const isRealFailure = (msg: string | null): boolean => !!msg && !isUpToDateError(msg);

function classifyPushResult(
  result: {
    ok: boolean;
    error: string | null;
    refs?: Record<string, { ok: boolean; error: string }>;
  },
  ref: string,
): ClassifiedPush {
  const refError = result.refs?.[ref]?.error ?? null;
  const failed = !result.ok || isRealFailure(result.error) || isRealFailure(refError);
  if (failed) return { kind: 'error', message: result.error ?? refError ?? 'unknown' };
  return { kind: 'ok', status: isUpToDateError(refError) ? 'up-to-date' : 'ok' };
}

@Injectable({ providedIn: 'root' })
export class RemoteService {
  private readonly workspace = inject(WorkspaceService);
  private readonly variants = inject(VariantsService);
  private readonly fsLock = inject(FsLockService);

  private readonly stateSignal = signal<RemoteSecretsFile>(emptyRemoteSecrets());
  private readonly pushingSignal = signal(false);
  private fileSynced = false;

  readonly config = computed(() => this.stateSignal().remote);
  readonly lastPushAt = computed(() => this.stateSignal().lastPushAt ?? null);
  readonly isPushing = this.pushingSignal.asReadonly();
  readonly isConfigured = computed(() => this.stateSignal().remote !== null);

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
    if (!isValidRemoteUrl(url) || token.length === 0) {
      throw new AppError(ERROR_CODES.NET_001, {
        severity: 'error',
        context: { reason: 'invalid-config' },
        recoverable: true,
      });
    }
    const fs = this.requireConfigFs();
    await ensureGitignoredSecrets(fs);
    const next: RemoteSecretsFile = {
      schemaVersion: REMOTE_SECRETS_SCHEMA_VERSION,
      remote: { url, token },
      ...(this.stateSignal().lastPushAt ? { lastPushAt: this.stateSignal().lastPushAt! } : {}),
    };
    await writeRemoteSecrets(fs, next);
    this.stateSignal.set(next);
  }

  async clear(): Promise<void> {
    const fs = this.requireConfigFs();
    const next = emptyRemoteSecrets();
    await writeRemoteSecrets(fs, next);
    this.stateSignal.set(next);
  }

  // 13e-i — manual push of the active variant's main. Errors are mapped
  // to NET_002 (auth) / NET_003 (other network / git failures); the
  // local repo state is never mutated by a failed push.
  async pushActiveMain(): Promise<PushOutcome> {
    const cfg = this.config();
    if (!cfg) {
      throw new AppError(ERROR_CODES.NET_001, {
        severity: 'error',
        context: { reason: 'not-configured' },
        recoverable: true,
      });
    }
    const active = this.variants.getActive();
    if (!active) {
      throw new AppError(ERROR_CODES.NET_001, {
        severity: 'error',
        context: { reason: 'no-active-variant' },
        recoverable: true,
      });
    }
    const ref = stripHeadsPrefix(active.refs.main);
    return this.fsLock.withLock(() => this.runPush(cfg, ref));
  }

  private async runPush(cfg: RemoteConfig, ref: string): Promise<PushOutcome> {
    this.pushingSignal.set(true);
    try {
      const adapter = this.requireGitFs();
      const result = await git.push({
        fs: adapter,
        http,
        dir: REPO_DIR,
        url: cfg.url,
        ref,
        remoteRef: ref,
        corsProxy: CORS_PROXY,
        onAuth: () => ({ username: cfg.token, password: 'x-oauth-basic' }),
      });
      const outcome = classifyPushResult(result, ref);
      if (outcome.kind === 'error') {
        throw new AppError(ERROR_CODES.NET_003, {
          severity: 'error',
          context: { ref, error: outcome.message },
          recoverable: true,
        });
      }
      await this.persistLastPushAt();
      return { ref, status: outcome.status, remoteRef: ref };
    } catch (cause) {
      if (cause instanceof AppError) throw cause;
      throw this.classifyPushError(cause, ref);
    } finally {
      this.pushingSignal.set(false);
    }
  }

  private classifyPushError(cause: unknown, ref: string): AppError {
    const message = String((cause as Error)?.message ?? cause ?? '');
    const isAuth = /401|403|unauthor|forbid|authentication/i.test(message);
    return new AppError(isAuth ? ERROR_CODES.NET_002 : ERROR_CODES.NET_003, {
      severity: 'error',
      cause,
      context: { ref, message },
      recoverable: true,
    });
  }

  private async persistLastPushAt(): Promise<void> {
    const fs = this.requireConfigFs();
    const next: RemoteSecretsFile = {
      ...this.stateSignal(),
      lastPushAt: new Date().toISOString(),
    };
    await writeRemoteSecrets(fs, next);
    this.stateSignal.set(next);
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const fs = this.requireConfigFs();
      const file = await readRemoteSecrets(fs);
      this.stateSignal.set(file);
    } catch {
      // workspace not ready, keep default state — effect will retry.
    }
  }

  private requireGitFs(): GitFsAdapter {
    const root = this.workspace.root();
    if (!root) {
      throw new AppError(ERROR_CODES.NET_001, {
        severity: 'error',
        context: { reason: 'workspace-not-ready' },
        recoverable: true,
      });
    }
    return new GitFsAdapter(root);
  }

  private requireConfigFs(): ConfigFs {
    const adapter = this.requireGitFs();
    return {
      readFile: async (path) => {
        const data = await adapter.readFile(path);
        return typeof data === 'string' ? TEXT_ENCODER.encode(data) : data;
      },
      writeFile: (path, content) => adapter.writeFile(path, content),
    };
  }
}
