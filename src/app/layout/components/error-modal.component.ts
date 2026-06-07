import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import type { AppError } from '@core/errors/app-error';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';

@Component({
  selector: 'mc-error-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="backdrop"
      aria-label="{{ t('common.close') }}"
      (click)="dismiss.emit()"
    ></button>
    <div class="modal" role="alertdialog" aria-modal="true" [attr.data-severity]="error().severity">
      <h2 class="title">{{ t(error().titleKey) }}</h2>
      <p class="message">{{ t(error().messageKey) }}</p>
      <p class="code mc-mono">{{ t('common.code') }}: {{ error().code }}</p>
      <div class="actions">
        <button type="button" class="primary" (click)="dismiss.emit()">
          {{ t('common.close') }}
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
      margin-bottom: var(--mc-space-3);
    }
    .code {
      font-size: var(--mc-font-size-xs);
      color: var(--mc-fg-dim);
      margin-bottom: var(--mc-space-4);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--mc-space-2);
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
    [data-severity='fatal'] {
      border-top: 3px solid var(--mc-state-danger);
    }
  `,
})
export class ErrorModalComponent {
  readonly error = input.required<AppError>();
  readonly dismiss = output<void>();

  private readonly i18n = inject(I18nService);

  protected t(key: string): string {
    return this.i18n.t(key as TranslationKey);
  }
}
