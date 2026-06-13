// 13e-iv — schedules pushAll after autocommit when the user opted in.
// Effect-subscribes to AutocommitService.lastCommitAt; the throttle and
// the safety gates (divergence / in-flight / not-configured) are pure
// (see `auto-push-scheduler.ts`).

import { Injectable, effect, inject } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { ErrorService } from '@core/errors/error.service';
import { SettingsService } from '@core/settings/settings.service';

import { AutocommitService } from './autocommit.service';
import { decideAutoPush, type SchedulerDecision } from './auto-push-scheduler';
import { RemoteService } from './remote.service';

@Injectable({ providedIn: 'root' })
export class AutoPushService {
  private readonly autocommit = inject(AutocommitService);
  private readonly remote = inject(RemoteService);
  private readonly settings = inject(SettingsService);
  private readonly errors = inject(ErrorService);
  private lastSeen: number | null = null;

  constructor() {
    effect(() => {
      const t = this.autocommit.lastCommitAt();
      if (!t) return;
      const ms = t.getTime();
      if (ms === this.lastSeen) return;
      this.lastSeen = ms;
      void this.evaluate();
    });
  }

  // why: app-shell calls this just to instantiate the service eagerly
  //      so the effect above is alive before the first autocommit fires.
  start(): void {
    /* no-op */
  }

  private async evaluate(): Promise<void> {
    const cfg = this.settings.state().versioning;
    const lastPushAt = this.remote.lastPushAt();
    const decision = decideAutoPush({
      enabled: cfg.pushAfterAutocommit,
      configured: this.remote.isConfigured(),
      throttleMinutes: cfg.pushThrottleMinutes,
      now: Date.now(),
      lastPushAt: lastPushAt ? new Date(lastPushAt).getTime() : null,
      hasDivergence: this.remote.hasDivergence(),
      inFlight: this.remote.isPushing(),
    });
    if (decision === 'push') {
      try {
        await this.remote.pushAll();
      } catch (e) {
        this.errors.report(e);
      }
      return;
    }
    this.reportSkip(decision, cfg.pushAfterAutocommit);
  }

  // why: skip-in-flight is the only skip we surface (NET_008, info).
  //      The others are expected silent paths (toggle off, throttle, etc.)
  //      and reporting them would spam the toast on every keystroke.
  private reportSkip(decision: SchedulerDecision, enabled: boolean): void {
    if (decision !== 'skip-in-flight' || !enabled) return;
    this.errors.report(
      new AppError(ERROR_CODES.NET_008, {
        severity: 'info',
        recoverable: true,
        context: { reason: 'push-in-flight' },
      }),
    );
  }
}
