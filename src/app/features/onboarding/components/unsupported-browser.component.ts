import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { IconComponent } from '@shared/icon/icon.component';

@Component({
  selector: 'mc-unsupported-browser',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <section class="card" role="alert">
      <mc-icon name="warning" class="alert-icon mc-anim-pulse" />
      <h1 class="title">{{ t('onboarding.unsupported.title') }}</h1>
      <p class="message">{{ t('onboarding.unsupported.message') }}</p>
      <p class="code mc-mono">{{ t('common.code') }}: MCB-SYS-001</p>
    </section>
  `,
  styles: `
    .card {
      max-width: 560px;
      margin: 10vh auto;
      padding: var(--mc-space-6);
      background: var(--mc-bg-surface);
      border: 1px solid var(--mc-state-danger);
      border-radius: var(--mc-radius-lg);
      box-shadow: var(--mc-shadow-md);
    }
    .alert-icon {
      font-size: 2.5rem;
      color: var(--mc-state-danger);
      display: block;
      margin-bottom: var(--mc-space-3);
    }
    .title {
      font-size: var(--mc-font-size-xl);
      margin-bottom: var(--mc-space-3);
    }
    .message {
      color: var(--mc-fg-muted);
      line-height: 1.5;
      margin-bottom: var(--mc-space-4);
    }
    .code {
      font-size: var(--mc-font-size-xs);
      color: var(--mc-fg-dim);
    }
  `,
})
export class UnsupportedBrowserComponent {
  private readonly i18n = inject(I18nService);
  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }
}
