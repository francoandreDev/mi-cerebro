import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';

export type LockBannerKind = 'foreign' | 'evicted';

@Component({
  selector: 'mc-note-lock-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="banner" role="alert">
      <div class="banner-body">
        <strong>{{ t(titleKey()) }}</strong>
        <span>{{ t(messageKey()) }}</span>
      </div>
      <div class="banner-actions">
        @if (kind() === 'foreign') {
          <button type="button" (click)="readonly.emit()">
            {{ t('notes.lock.foreign.readonly') }}
          </button>
          <button type="button" class="primary" (click)="takeover.emit()">
            {{ t('notes.lock.foreign.takeover') }}
          </button>
        } @else {
          <button type="button" class="primary" (click)="dismiss.emit()">
            {{ t('notes.lock.evicted.dismiss') }}
          </button>
        }
      </div>
    </div>
  `,
  styles: `
    .banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--mc-space-3);
      padding: var(--mc-space-3) var(--mc-space-4);
      background: var(--mc-bg-elevated);
      border-bottom: 1px solid var(--mc-border-default);
      border-left: 3px solid var(--mc-accent-primary);
    }
    .banner-body {
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-1);
    }
    .banner-actions {
      display: flex;
      gap: var(--mc-space-2);
    }
    .banner-actions button {
      background: transparent;
      color: var(--mc-fg-primary);
      border: 1px solid var(--mc-border-default);
      padding: var(--mc-space-1) var(--mc-space-3);
      border-radius: var(--mc-radius-md);
      cursor: pointer;
    }
    .banner-actions button.primary {
      background: var(--mc-accent-primary);
      color: var(--mc-bg-base);
      border-color: var(--mc-accent-primary);
    }
  `,
})
export class NoteLockBannerComponent {
  readonly kind = input.required<LockBannerKind>();
  readonly readonly = output<void>();
  readonly takeover = output<void>();
  readonly dismiss = output<void>();

  private readonly i18n = inject(I18nService);

  protected titleKey(): TranslationKey {
    return this.kind() === 'foreign' ? 'notes.lock.foreign.title' : 'notes.lock.evicted.title';
  }

  protected messageKey(): TranslationKey {
    return this.kind() === 'foreign' ? 'notes.lock.foreign.message' : 'notes.lock.evicted.message';
  }

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }
}
