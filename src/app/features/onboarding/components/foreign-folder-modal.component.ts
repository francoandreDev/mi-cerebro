import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { IconComponent } from '@shared/icon/icon.component';

@Component({
  selector: 'mc-foreign-folder-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="backdrop" aria-hidden="true"></div>
    <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="ffm-title">
      <h2 id="ffm-title" class="title">
        <mc-icon name="folder-open" class="title-icon" />
        <span>{{ t('onboarding.foreign.title') }}</span>
      </h2>
      <p class="message">
        {{ t('onboarding.foreign.message') }}
        <span class="folder mc-mono">{{ folderName() }}</span>
      </p>
      <div class="actions">
        <button type="button" class="secondary mc-hover-grow" (click)="chooseOther.emit()">
          <mc-icon name="folder" />
          <span>{{ t('common.chooseAnother') }}</span>
        </button>
        <button type="button" class="primary mc-hover-grow" (click)="confirm.emit()">
          <mc-icon name="check" />
          <span>{{ t('onboarding.foreign.initHere') }}</span>
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
      display: inline-flex;
      align-items: center;
      gap: var(--mc-space-2);
    }
    .title-icon {
      color: var(--mc-accent-primary);
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
      display: inline-flex;
      align-items: center;
      gap: 6px;
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
