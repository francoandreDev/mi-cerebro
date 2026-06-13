// 13e-ii — /sync page: Push todo / Fetch todo for every variant × 3
// facets, with the per-ref status table. Errors bubble through
// ErrorService so the modal/toast renders the NET-004/005 code; the
// table here reads `lastPushOutcomes` / `lastFetchOutcomes` after the
// call, so partial failures are still browsable.

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ErrorService } from '@core/errors/error.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { SettingsService } from '@core/settings/settings.service';
import { RemoteService } from '@core/versioning/remote.service';
import { listRefTargets } from '@core/versioning/remote-bulk';
import type { RefSyncOutcome, RefSyncStatus } from '@core/versioning/remote.types';
import { VariantsService } from '@core/versioning/variants.service';
import { McDatePipe } from '@shared/pipes/mc-date.pipe';

interface Row {
  readonly variantId: string;
  readonly variantName: string;
  readonly facet: string;
  readonly ref: string;
  readonly status: RefSyncStatus | 'idle';
  readonly error?: string;
  readonly lastSyncAt: string | null;
}

@Component({
  selector: 'mc-sync',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, McDatePipe],
  templateUrl: './sync.container.html',
  styleUrl: './sync.container.css',
})
export class SyncContainer {
  private readonly remote = inject(RemoteService);
  private readonly variants = inject(VariantsService);
  private readonly settings = inject(SettingsService);
  private readonly i18n = inject(I18nService);
  private readonly errors = inject(ErrorService);

  protected readonly versioningSettings = computed(() => this.settings.state().versioning);

  protected readonly isConfigured = this.remote.isConfigured;
  protected readonly isPushing = this.remote.isPushing;
  protected readonly isFetching = this.remote.isFetching;
  protected readonly hasDivergence = this.remote.hasDivergence;
  protected readonly lastBulkAt = this.remote.lastBulkAt;
  protected readonly lastPushOutcomes = this.remote.lastPushOutcomes;
  protected readonly lastFetchOutcomes = this.remote.lastFetchOutcomes;

  protected readonly rows = computed<readonly Row[]>(() => {
    const file = this.variants.file();
    const targets = listRefTargets(file.variants.filter((v) => !v.pendingDelete));
    const pushBy = indexOutcomes(this.lastPushOutcomes());
    const fetchBy = indexOutcomes(this.lastFetchOutcomes());
    const bulkAt = this.lastBulkAt();
    return targets.map((t) => {
      const variant = file.variants.find((v) => v.id === t.variantId);
      const o = pushBy.get(t.ref) ?? fetchBy.get(t.ref);
      return {
        variantId: t.variantId,
        variantName: variant?.name ?? t.variantId,
        facet: t.facet,
        ref: t.ref,
        status: o?.status ?? 'idle',
        ...(o?.error ? { error: o.error } : {}),
        lastSyncAt: o ? bulkAt : null,
      };
    });
  });

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
