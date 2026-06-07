import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';

@Component({
  selector: 'mc-loading-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap" role="status" aria-live="polite">
      <p class="text">{{ t(messageKey()) }}</p>
    </div>
  `,
  styles: `
    .wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
    }
    .text {
      color: var(--mc-fg-muted);
      font-size: var(--mc-font-size-lg);
    }
  `,
})
export class LoadingScreenComponent {
  readonly messageKey = input.required<TranslationKey>();

  private readonly i18n = inject(I18nService);
  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }
}
