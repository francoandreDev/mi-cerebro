// Background autocommit driver for paso 13a. Wires triggers (5 min
// timer, route change at entity/feature boundary, beforeunload, tab
// hide) to VersioningService.commitAll, gated by a 60s throttle and
// serialized against autosave via FsLockService. Started on workspace
// ready and stopped on workspace reset. Exposes state and lastCommitAt
// signals for the sidebar footer.

import { Injectable, effect, inject, signal } from '@angular/core';
import * as git from 'isomorphic-git';
import { NavigationStart, Router } from '@angular/router';

import { AutosaveService } from '@core/autosave/autosave.service';
import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { ErrorService } from '@core/errors/error.service';
import { FsLockService } from '@core/fs/fs-lock.service';
import { FsService } from '@core/fs/fs.service';
import { WorkspaceService } from '@core/fs/workspace.service';
import { SettingsService } from '@core/settings/settings.service';

import {
  AUTOCOMMIT_THROTTLE_MS,
  autocommitMinutesToMs,
  deriveAutocommitMessage,
} from './autocommit.constants';
import { GitFsAdapter } from './git-fs.adapter';
import { VersioningService } from './versioning.service';

type AutocommitState = 'idle' | 'committing';

@Injectable({ providedIn: 'root' })
export class AutocommitService {
  private readonly versioning = inject(VersioningService);
  private readonly autosave = inject(AutosaveService);
  private readonly fsLock = inject(FsLockService);
  private readonly workspace = inject(WorkspaceService);
  private readonly router = inject(Router);
  private readonly errors = inject(ErrorService);
  private readonly settings = inject(SettingsService);
  private readonly fs = inject(FsService);

  private readonly stateSignal = signal<AutocommitState>('idle');
  private readonly lastCommitAtSignal = signal<Date | null>(null);
  readonly state = this.stateSignal.asReadonly();
  readonly lastCommitAt = this.lastCommitAtSignal.asReadonly();

  private timerHandle: ReturnType<typeof setInterval> | null = null;
  private timerIntervalMs = 0;
  private lastAttemptAt = 0;

  constructor() {
    // why: react to live changes of `versioning.autocommitMinutes` from
    //      /settings. The timer is only active between start()/stop(),
    //      so guard on `timerHandle` to avoid spawning one early.
    effect(() => {
      const ms = autocommitMinutesToMs(this.settings.state().versioning.autocommitMinutes);
      if (this.timerHandle !== null && ms !== this.timerIntervalMs) {
        this.resetTimer(ms);
      }
    });
  }
  private currentFeature = '';
  private currentEntityId = '';
  private routerSub: { unsubscribe(): void } | null = null;
  private readonly hiddenHandler = (): void => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      void this.tryCommit('visibility');
    }
  };
  private readonly beforeUnloadHandler = (): void => {
    void this.tryCommit('beforeunload');
  };

  start(): void {
    if (this.timerHandle !== null) return;
    void this.bootstrap().catch((cause: unknown) => {
      this.errors.report(this.wrapError(cause, 'ensureRepo'));
    });
    this.timerIntervalMs = autocommitMinutesToMs(
      this.settings.state().versioning.autocommitMinutes,
    );
    this.timerHandle = setInterval(() => void this.tryCommit('timer'), this.timerIntervalMs);
    this.routerSub = this.router.events.subscribe((e) => {
      if (e instanceof NavigationStart) this.onNavigation(e.url);
    });
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.hiddenHandler);
      window.addEventListener('beforeunload', this.beforeUnloadHandler);
    }
  }

  stop(): void {
    if (this.timerHandle !== null) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
      this.timerIntervalMs = 0;
    }
    this.routerSub?.unsubscribe();
    this.routerSub = null;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.hiddenHandler);
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    }
  }

  private resetTimer(ms: number): void {
    if (this.timerHandle === null) return;
    clearInterval(this.timerHandle);
    this.timerIntervalMs = ms;
    this.timerHandle = setInterval(() => void this.tryCommit('timer'), ms);
  }

  // Manual entry point for explicit user actions or future triggers.
  // why: customMessage bypasses the `auto: N kind [reason]` format so callers
  //      like restore can label the commit semantically.
  async commitNow(reason = 'manual', customMessage?: string): Promise<string | null> {
    return this.runCommit(reason, customMessage);
  }

  private async bootstrap(): Promise<void> {
    await this.versioning.ensureRepo();
    // why: lastCommitAt is in-memory; on reload we recover the timestamp
    //      from the most recent commit so the footer shows the real
    //      relative time instead of "Sin commits aún".
    const entries = await this.versioning.log(1).catch(() => []);
    if (entries.length > 0) {
      this.lastCommitAtSignal.set(new Date(entries[0]!.authorTimestamp));
    }
  }

  private onNavigation(url: string): void {
    const segs = url
      .split('?')[0]!
      .split('/')
      .filter((s) => s.length > 0);
    const nextFeature = segs[0] ?? '';
    const nextEntity = segs[1] ?? '';
    const featureChanged = nextFeature !== this.currentFeature;
    const entityChanged = nextEntity !== this.currentEntityId;
    this.currentFeature = nextFeature;
    this.currentEntityId = nextEntity;
    if (featureChanged || entityChanged) {
      void this.tryCommit(featureChanged ? 'feature-change' : 'entity-close');
    }
  }

  private async tryCommit(reason: string): Promise<string | null> {
    const now = Date.now();
    if (now - this.lastAttemptAt < AUTOCOMMIT_THROTTLE_MS) return null;
    this.lastAttemptAt = now;
    return this.runCommit(reason);
  }

  private async runCommit(reason: string, customMessage?: string): Promise<string | null> {
    if (!this.workspace.isReady()) return null;
    if (this.stateSignal() === 'committing') return null;
    try {
      // Drain pending autosaves first so the upcoming statusMatrix
      // includes their FS writes. flushAll already routes onFlush
      // through the lock.
      await this.autosave.flushAll();
      this.stateSignal.set('committing');
      const oid = await this.fsLock.withLock(() => this.commitWithMessage(reason, customMessage));
      if (oid) this.lastCommitAtSignal.set(new Date());
      return oid;
    } catch (cause) {
      this.errors.report(this.wrapError(cause, reason));
      return null;
    } finally {
      this.stateSignal.set('idle');
    }
  }

  private async commitWithMessage(reason: string, customMessage?: string): Promise<string | null> {
    const adapter = this.adapter();
    if (!adapter) return null;
    const matrix = await git.statusMatrix({ fs: adapter, dir: '/' });
    const dirty = matrix.filter(([, h, w, s]) => h !== w || h !== s);
    const ignored = await Promise.all(
      dirty.map(([filepath]) => git.isIgnored({ fs: adapter, dir: '/', filepath })),
    );
    const visible = dirty.filter((_, i) => !ignored[i]).map(([p]) => p);
    if (visible.length === 0) return null;
    const message = customMessage ?? `${deriveAutocommitMessage(visible)} [${reason}]`;
    return this.versioning.commitAll(message);
  }

  private adapter(): GitFsAdapter | null {
    const root = this.workspace.root();
    return root ? new GitFsAdapter(root, this.fs) : null;
  }

  private wrapError(cause: unknown, reason: string): AppError {
    if (cause instanceof AppError) return cause;
    return new AppError(ERROR_CODES.VER_002, {
      severity: 'warning',
      cause,
      context: { reason },
      recoverable: true,
    });
  }
}
