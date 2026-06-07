import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';

@Component({
  selector: 'mc-permission-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="banner" role="alert" aria-live="polite">
      <div class="text">
        <strong class="title">{{ t('permission.banner.title') }}</strong>
        <span class="message">{{ message() }}</span>
        <span class="code mc-mono">MCB-FS-004</span>
      </div>
      <button type="button" class="primary" (click)="reauth.emit()">
        {{ t('permission.banner.action') }}
      </button>
    </div>
  `,
  styles: `
    .banner {
      position: sticky;
      top: 0;
      z-index: 900;
      display: flex;
      align-items: center;
      gap: var(--mc-space-3);
      padding: var(--mc-space-3) var(--mc-space-4);
      background: var(--mc-bg-elevated);
      border-bottom: 3px solid var(--mc-state-warning);
    }
    .text {
      display: grid;
      gap: var(--mc-space-1);
      flex: 1;
    }
    .title {
      font-weight: 600;
    }
    .message {
      color: var(--mc-fg-muted);
      font-size: var(--mc-font-size-sm);
    }
    .code {
      font-size: var(--mc-font-size-xs);
      color: var(--mc-fg-dim);
    }
    .primary {
      background: var(--mc-accent-primary);
      color: var(--mc-accent-fg);
      padding: var(--mc-space-2) var(--mc-space-4);
      border-radius: var(--mc-radius-md);
      font-weight: 600;
    }
    .primary:hover {
      background: var(--mc-accent-hover);
    }
  `,
})
export class PermissionBannerComponent {
  readonly folderName = input.required<string>();
  readonly reauth = output<void>();

  private readonly i18n = inject(I18nService);
  protected message(): string {
    return this.i18n.t('permission.banner.message', { name: this.folderName() });
  }
  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }
}
