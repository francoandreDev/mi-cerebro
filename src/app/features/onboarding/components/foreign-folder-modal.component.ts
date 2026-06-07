import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';

@Component({
  selector: 'mc-foreign-folder-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="backdrop" aria-hidden="true"></div>
    <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="ffm-title">
      <h2 id="ffm-title" class="title">{{ t('onboarding.foreign.title') }}</h2>
      <p class="message">
        {{ t('onboarding.foreign.message') }}
        <span class="folder mc-mono">{{ folderName() }}</span>
      </p>
      <div class="actions">
        <button type="button" class="secondary" (click)="chooseOther.emit()">
          {{ t('common.chooseAnother') }}
        </button>
        <button type="button" class="primary" (click)="confirm.emit()">
          {{ t('onboarding.foreign.initHere') }}
        </button>
      </div>
    </div>
  `,
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgb(0 0 0 / 0.5);
      z-index: 1000;
    }
    .modal {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 1001;
      background: var(--mc-bg-elevated);
      border: 1px solid var(--mc-border-default);
      border-radius: var(--mc-radius-lg);
      box-shadow: var(--mc-shadow-lg);
      padding: var(--mc-space-5);
      min-width: 360px;
      max-width: 560px;
    }
    .title {
      font-size: var(--mc-font-size-xl);
      margin-bottom: var(--mc-space-2);
    }
    .message {
      color: var(--mc-fg-muted);
      margin-bottom: var(--mc-space-4);
      line-height: 1.5;
    }
    .folder {
      display: block;
      margin-top: var(--mc-space-2);
      color: var(--mc-fg-primary);
      font-size: var(--mc-font-size-sm);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--mc-space-2);
    }
    .primary,
    .secondary {
      padding: var(--mc-space-2) var(--mc-space-4);
      border-radius: var(--mc-radius-md);
      font-weight: 600;
    }
    .primary {
      background: var(--mc-accent-primary);
      color: var(--mc-accent-fg);
    }
    .primary:hover {
      background: var(--mc-accent-hover);
    }
    .secondary {
      background: transparent;
      color: var(--mc-fg-primary);
      border: 1px solid var(--mc-border-default);
    }
    .secondary:hover {
      background: var(--mc-bg-surface);
    }
  `,
})
export class ForeignFolderModalComponent {
  readonly folderName = input.required<string>();
  readonly confirm = output<void>();
  readonly chooseOther = output<void>();

  private readonly i18n = inject(I18nService);
  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }
}
