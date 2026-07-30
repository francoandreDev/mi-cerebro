// /sync page: Push todo / Fetch todo for every variant × 3 facets,
// rendered as a pneumatic-tube console.
// Errors bubble through ErrorService so the modal/toast renders the
// NET-004/005 code; the console reads `lastPushOutcomes` /
// `lastFetchOutcomes` after the call, so partial failures are still
// browsable per-tube.

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { ErrorService } from '@core/errors/error.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { SettingsService } from '@core/settings/settings.service';
import { AutoPushService } from '@core/versioning/auto-push.service';
import { RemoteService } from '@core/versioning/remote.service';
import {
  FACETS,
  type Facet,
  type RefSyncOutcome,
  type RefSyncStatus,
} from '@core/versioning/remote.types';
import { stripHeadsPrefix } from '@core/versioning/variants.io';
import { VariantsService } from '@core/versioning/variants.service';
import { IconComponent } from '@shared/icon/icon.component';
import { McDatePipe } from '@shared/pipes/mc-date.pipe';

import { registerSyncTutorial } from './sync.tutorial';

export type TubeStatus = RefSyncStatus | 'idle' | 'divergent';

interface Tube {
  readonly variantId: string;
  readonly facet: Facet;
  readonly ref: string;
  readonly status: TubeStatus;
  readonly error?: string;
  readonly lastSyncAt: string | null;
}

interface ConsoleRow {
  readonly variantId: string;
  readonly variantName: string;
  readonly tubes: readonly Tube[];
}

@Component({
  selector: 'mc-sync',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, McDatePipe, IconComponent],
  templateUrl: './sync.container.html',
  styleUrl: './sync.container.css',
})
export class SyncContainer {
  private readonly remote = inject(RemoteService);
  private readonly variants = inject(VariantsService);
  private readonly settings = inject(SettingsService);
  private readonly i18n = inject(I18nService);
  private readonly errors = inject(ErrorService);
  private readonly autoPush = inject(AutoPushService);

  // why: throttle remaining and skip spark need to re-evaluate on a
  //      wall-clock cadence — signal ticks every 15s (throttle is minutes).
  private readonly nowTick = signal(Date.now());
  private readonly skipSparkSignal = signal(false);
  protected readonly skipSpark = this.skipSparkSignal.asReadonly();

  protected readonly versioningSettings = computed(() => this.settings.state().versioning);

  protected readonly isConfigured = this.remote.isConfigured;
  protected readonly isPushing = this.remote.isPushing;
  protected readonly isFetching = this.remote.isFetching;
  protected readonly hasDivergence = this.remote.hasDivergence;
  protected readonly lastBulkAt = this.remote.lastBulkAt;
  protected readonly lastPushOutcomes = this.remote.lastPushOutcomes;
  protected readonly lastFetchOutcomes = this.remote.lastFetchOutcomes;

  protected readonly divergentRefs = this.remote.divergentRefs;
  protected readonly facets = FACETS;

  protected readonly consoleRows = computed<readonly ConsoleRow[]>(() => {
    const file = this.variants.file();
    const active = file.variants.filter((v) => !v.pendingDelete);
    const pushBy = indexOutcomes(this.lastPushOutcomes());
    const fetchBy = indexOutcomes(this.lastFetchOutcomes());
    const bulkAt = this.lastBulkAt();
    const divergent = new Set(this.divergentRefs().map((d) => d.ref));
    return active.map((v) => ({
      variantId: v.id,
      variantName: v.name,
      tubes: FACETS.map<Tube>((facet) => {
        const ref = stripHeadsPrefix(v.refs[facet]);
        const o = pushBy.get(ref) ?? fetchBy.get(ref);
        const isDivergent = divergent.has(ref);
        const status: TubeStatus = isDivergent ? 'divergent' : (o?.status ?? 'idle');
        return {
          variantId: v.id,
          facet,
          ref,
          status,
          ...(o?.error ? { error: o.error } : {}),
          lastSyncAt: o ? bulkAt : null,
        };
      }),
    }));
  });

  // Time remaining (ms) until the auto-push throttle window closes. Positive
  // → hourglass counts down; null when disabled / no prior push / already
  // ready. Derived only from real state (lastPushAt + settings), never faked.
  protected readonly throttleRemainingMs = computed<number | null>(() => {
    const cfg = this.versioningSettings();
    if (!cfg.pushAfterAutocommit) return null;
    const last = this.remote.lastPushAt();
    if (!last) return null;
    const windowMs = cfg.pushThrottleMinutes * 60_000;
    const remaining = windowMs - (this.nowTick() - new Date(last).getTime());
    return remaining > 0 ? remaining : null;
  });

  protected readonly throttleRemainingLabel = computed<string>(() => {
    const ms = this.throttleRemainingMs();
    if (ms === null) return '';
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  });

  constructor() {
    registerSyncTutorial();
    const destroyRef = inject(DestroyRef);
    const interval = setInterval(() => this.nowTick.set(Date.now()), 15_000);
    destroyRef.onDestroy(() => clearInterval(interval));
    let sparkTimer: ReturnType<typeof setTimeout> | null = null;
    // why: MCB-NET-008 (auto-push skipped, another push in-flight) surfaces
    //      as a fleeting spark over the crank. Effect fires when the skip
    //      timestamp changes; timeout clears the visual after 1600ms.
    effect(() => {
      const at = this.autoPush.lastSkipAt();
      if (at === null) return;
      this.skipSparkSignal.set(true);
      if (sparkTimer !== null) clearTimeout(sparkTimer);
      sparkTimer = setTimeout(() => this.skipSparkSignal.set(false), 1600);
    });
    destroyRef.onDestroy(() => {
      if (sparkTimer !== null) clearTimeout(sparkTimer);
    });
  }

  protected facetLabel(facet: Facet): string {
    return this.t(`versioning.history.facet.${facet}`);
  }

  // Which honest flight animation (if any) applies to this tube right now.
  // `push` / `fetch` only while a bulk op is actually in flight; divergent
  // and error tubes stay static so the halo/collision can be read.
  protected tubeFlight(tube: Tube): 'push' | 'fetch' | null {
    if (tube.status === 'divergent' || tube.status === 'error') return null;
    if (this.isPushing()) return 'push';
    if (this.isFetching()) return 'fetch';
    return null;
  }

  protected tubeStatusLabel(status: TubeStatus): string {
    if (status === 'divergent') return this.t('sync.status.divergent');
    return this.statusLabel(status);
  }

  protected readonly summary = computed(() => {
    const last = this.lastPushOutcomes() ?? this.lastFetchOutcomes();
    if (!last) return { kind: 'never' as const };
    const errors = last.filter((o) => o.status === 'error').length;
    if (errors === 0) return { kind: 'allOk' as const, count: last.length };
    return { kind: 'partial' as const, errors, total: last.length };
  });

  protected t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  protected statusLabel(status: RefSyncStatus | 'idle'): string {
    switch (status) {
      case 'ok':
        return this.t('sync.status.ok');
      case 'up-to-date':
        return this.t('sync.status.upToDate');
      case 'error':
        return this.t('sync.status.error');
      case 'absent':
        return this.t('sync.status.absent');
      case 'idle':
        return this.t('sync.status.idle');
    }
  }

  protected async pushAll(): Promise<void> {
    try {
      await this.remote.pushAll();
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected async fetchAll(): Promise<void> {
    try {
      await this.remote.fetchAll();
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected onTogglePushAfter(event: Event): void {
    this.settings.setPushAfterAutocommit((event.target as HTMLInputElement).checked);
  }

  protected onThrottleInput(event: Event): void {
    const v = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(v)) this.settings.setPushThrottleMinutes(v);
  }
}

function indexOutcomes(outcomes: readonly RefSyncOutcome[] | null): Map<string, RefSyncOutcome> {
  const m = new Map<string, RefSyncOutcome>();
  if (!outcomes) return m;
  for (const o of outcomes) m.set(o.ref, o);
  return m;
}
