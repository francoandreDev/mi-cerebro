import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { IconComponent } from '@shared/icon/icon.component';

@Component({
  selector: 'mc-loading-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="wrap" role="status" aria-live="polite">
      <mc-icon name="spinner-gap" class="spinner mc-anim-spin" />
      <p class="text">{{ t(messageKey()) }}</p>
    </div>
  `,
  styles: `
    .wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--mc-space-3);
      min-height: 60vh;
    }
    .spinner {
      font-size: 2.5rem;
      color: var(--mc-accent-primary);
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
