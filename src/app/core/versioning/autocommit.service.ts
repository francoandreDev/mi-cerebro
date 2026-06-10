// Background autocommit driver for paso 13a. Wires triggers (5 min
// timer, route change at entity/feature boundary, beforeunload, tab
// hide) to VersioningService.commitAll, gated by a 60s throttle and
// serialized against autosave via FsLockService. Started on workspace
// ready and stopped on workspace reset. Exposes state and lastCommitAt
// signals for the sidebar footer.

import { Injectable, inject, signal } from '@angular/core';
import * as git from 'isomorphic-git';
import { NavigationStart, Router } from '@angular/router';

import { AutosaveService } from '@core/autosave/autosave.service';
import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { ErrorService } from '@core/errors/error.service';
import { FsLockService } from '@core/fs/fs-lock.service';
import { WorkspaceService } from '@core/fs/workspace.service';

import {
  AUTOCOMMIT_THROTTLE_MS,
  AUTOCOMMIT_TIMER_MS,
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

  private readonly stateSignal = signal<AutocommitState>('idle');
  private readonly lastCommitAtSignal = signal<Date | null>(null);
  readonly state = this.stateSignal.asReadonly();
  readonly lastCommitAt = this.lastCommitAtSignal.asReadonly();

  private timerHandle: ReturnType<typeof setInterval> | null = null;
  private lastAttemptAt = 0;
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
    this.timerHandle = setInterval(() => void this.tryCommit('timer'), AUTOCOMMIT_TIMER_MS);
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
    }
    this.routerSub?.unsubscribe();
    this.routerSub = null;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.hiddenHandler);
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    }
  }

  // Manual entry point for explicit user actions or future triggers.
  async commitNow(reason = 'manual'): Promise<string | null> {
    return this.runCommit(reason);
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

  private async runCommit(reason: string): Promise<string | null> {
    if (!this.workspace.isReady()) return null;
    if (this.stateSignal() === 'committing') return null;
    try {
      // Drain pending autosaves first so the upcoming statusMatrix
      // includes their FS writes. flushAll already routes onFlush
      // through the lock.
      await this.autosave.flushAll();
      this.stateSignal.set('committing');
      const oid = await this.fsLock.withLock(() => this.commitWithMessage(reason));
      if (oid) this.lastCommitAtSignal.set(new Date());
      return oid;
    } catch (cause) {
      this.errors.report(this.wrapError(cause, reason));
      return null;
    } finally {
      this.stateSignal.set('idle');
    }
  }

  private async commitWithMessage(reason: string): Promise<string | null> {
    const adapter = this.adapter();
    if (!adapter) return null;
    const matrix = await git.statusMatrix({ fs: adapter, dir: '/' });
    const dirty = matrix.filter(([, h, w, s]) => h !== w || h !== s);
    const ignored = await Promise.all(
      dirty.map(([filepath]) => git.isIgnored({ fs: adapter, dir: '/', filepath })),
    );
    const visible = dirty.filter((_, i) => !ignored[i]).map(([p]) => p);
    if (visible.length === 0) return null;
    const message = `${deriveAutocommitMessage(visible)} [${reason}]`;
    return this.versioning.commitAll(message);
  }

  private adapter(): GitFsAdapter | null {
    const root = this.workspace.root();
    return root ? new GitFsAdapter(root) : null;
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
