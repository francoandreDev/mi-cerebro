import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';

@Component({
  selector: 'mc-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="head">
      <h2>{{ t('versioning.history.title') }}</h2>
    </header>
    <p class="placeholder">{{ t('versioning.history.placeholder') }}</p>
  `,
  styles: `
    :host {
      display: block;
      padding: 16px;
    }
    .head {
      margin-bottom: 16px;
    }
    .placeholder {
      color: var(--mc-fg-secondary, #666);
    }
  `,
})
export class HistoryContainer {
  private readonly i18n = inject(I18nService);
  protected t(key: 'versioning.history.title' | 'versioning.history.placeholder'): string {
    return this.i18n.t(key);
  }
}
