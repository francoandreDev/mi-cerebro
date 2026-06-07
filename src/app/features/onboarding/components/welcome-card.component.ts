import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';

@Component({
  selector: 'mc-welcome-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card" role="region" aria-labelledby="welcome-title">
      <h1 id="welcome-title" class="title">{{ t('onboarding.welcome.title') }}</h1>
      <p class="line">{{ t('onboarding.welcome.line1') }}</p>
      <p class="line">{{ t('onboarding.welcome.line2') }}</p>
      <p class="line">{{ t('onboarding.welcome.line3') }}</p>
      <button type="button" class="primary" (click)="choose.emit()">
        {{ t('common.chooseFolder') }}
      </button>
    </section>
  `,
  styles: `
    .card {
      max-width: 560px;
      margin: 10vh auto;
      padding: var(--mc-space-6);
      background: var(--mc-bg-surface);
      border: 1px solid var(--mc-border-default);
      border-radius: var(--mc-radius-lg);
      box-shadow: var(--mc-shadow-md);
    }
    .title {
      font-size: var(--mc-font-size-2xl);
      margin-bottom: var(--mc-space-4);
    }
    .line {
      color: var(--mc-fg-muted);
      margin-bottom: var(--mc-space-2);
      line-height: 1.5;
    }
    .primary {
      margin-top: var(--mc-space-4);
      background: var(--mc-accent-primary);
      color: var(--mc-accent-fg);
      padding: var(--mc-space-3) var(--mc-space-5);
      border-radius: var(--mc-radius-md);
      font-weight: 600;
      font-size: var(--mc-font-size-md);
    }
    .primary:hover {
      background: var(--mc-accent-hover);
    }
  `,
})
export class WelcomeCardComponent {
  readonly choose = output<void>();

  private readonly i18n = inject(I18nService);
  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }
}
