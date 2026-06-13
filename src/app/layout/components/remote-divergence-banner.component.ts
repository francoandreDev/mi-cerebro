// 13e-iii — global banner that appears whenever RemoteService has
// divergent refs from the last fetch. Non-closable by design: pushAll
// is blocked until the user resolves at /variants/merge.

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { I18nService } from '@core/i18n/i18n.service';
import { RemoteService } from '@core/versioning/remote.service';

@Component({
  selector: 'mc-remote-divergence-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="banner" role="alert">
        <span class="msg">{{ message() }}</span>
        <button type="button" class="primary" (click)="openMerge()">
          {{ t('remote.divergence.openMerge') }}
        </button>
      </div>
    }
  `,
  styles: `
    :host {
      display: contents;
    }
    .banner {
      position: sticky;
      top: 0;
      z-index: 30;
      display: flex;
      gap: var(--mc-space-3);
      align-items: center;
      padding: var(--mc-space-2) var(--mc-space-4);
      background: color-mix(in oklab, var(--mc-color-danger, #c4314b) 22%, transparent);
      border-bottom: 1px solid var(--mc-color-danger, #c4314b);
      color: var(--mc-fg-primary);
      font-size: var(--mc-font-size-sm);
    }
    .msg {
      flex: 1;
    }
  `,
})
export class RemoteDivergenceBannerComponent {
  private readonly remote = inject(RemoteService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  protected readonly visible = computed(() => this.remote.hasDivergence());
  protected readonly message = computed(() =>
    this.i18n.t('remote.divergence.banner', { count: this.remote.divergentRefs().length }),
  );

  protected t(key: 'remote.divergence.openMerge'): string {
    return this.i18n.t(key);
  }

  protected openMerge(): void {
    const first = this.remote.divergentRefs()[0];
    if (!first) return;
    void this.router.navigate(['/variants/merge'], {
      queryParams: { incoming: 'remote', ref: first.ref, into: first.variantId },
    });
  }
}
