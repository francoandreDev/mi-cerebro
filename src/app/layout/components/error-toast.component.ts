import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import type { AppError } from '@core/errors/app-error';
import type { ErrorAction } from '@core/errors/error.types';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';

@Component({
  selector: 'mc-error-toast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast" role="status" [attr.data-severity]="error().severity">
      <span class="title">{{ t(error().titleKey) }}</span>
      <span class="message">{{ t(error().messageKey) }}</span>
      <span class="code mc-mono">{{ error().code }}</span>
      <div class="actions">
        @for (action of error().actions; track action.labelKey) {
          <button type="button" class="action" (click)="runAction(action)">
            {{ t(action.labelKey) }}
          </button>
        }
        <button type="button" class="close" (click)="dismiss.emit()">
          {{ t('common.close') }}
        </button>
      </div>
    </div>
  `,
  styles: `
    .toast {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: var(--mc-space-1) var(--mc-space-3);
      align-items: center;
      padding: var(--mc-space-3) var(--mc-space-4);
      background: var(--mc-bg-elevated);
      border: 1px solid var(--mc-border-default);
      border-radius: var(--mc-radius-md);
      box-shadow: var(--mc-shadow-md);
      min-width: 320px;
      max-width: 480px;
    }
    .title {
      font-weight: 600;
    }
    .message {
      grid-column: 1 / -1;
      color: var(--mc-fg-muted);
      font-size: var(--mc-font-size-sm);
    }
    .code {
      font-size: var(--mc-font-size-xs);
      color: var(--mc-fg-dim);
    }
    .actions {
      grid-column: 2;
      display: flex;
      gap: var(--mc-space-3);
      align-items: center;
    }
    .action,
    .close {
      color: var(--mc-accent-primary);
      font-size: var(--mc-font-size-sm);
    }
    [data-severity='warning'] {
      border-left: 3px solid var(--mc-state-warning);
    }
    [data-severity='info'] {
      border-left: 3px solid var(--mc-state-info);
    }
  `,
})
export class ErrorToastComponent {
  readonly error = input.required<AppError>();
  readonly dismiss = output<void>();

  private readonly i18n = inject(I18nService);

  protected t(key: string): string {
    return this.i18n.t(key as TranslationKey);
  }

  protected async runAction(action: ErrorAction): Promise<void> {
    await action.run();
    this.dismiss.emit();
  }
}
