import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { ReminderSchedulerService } from '@core/reminders/reminder-scheduler.service';

@Component({
  selector: 'mc-reminder-toast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (scheduler.active(); as r) {
      <div role="status" class="toast">
        <div class="body">
          <strong>⏰ {{ t('reminders.toast.title') }}</strong>
          <span class="title">{{ r.title || t('reminders.untitled') }}</span>
        </div>
        <div class="actions">
          <button type="button" class="link" (click)="goToReminders()">
            {{ t('reminders.toast.open') }}
          </button>
          <button type="button" class="ghost" (click)="scheduler.dismiss()" aria-label="Cerrar">
            ✕
          </button>
        </div>
      </div>
    }
  `,
  styles: `
    .toast {
      position: fixed;
      right: var(--mc-space-3);
      bottom: var(--mc-space-3);
      background: var(--mc-bg-elevated);
      border: 1px solid var(--mc-accent-primary);
      border-radius: var(--mc-radius-md);
      padding: var(--mc-space-2) var(--mc-space-3);
      display: flex;
      gap: var(--mc-space-3);
      align-items: center;
      max-width: 360px;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25);
      z-index: 200;
    }
    .body {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .title {
      color: var(--mc-fg-primary);
    }
    .actions {
      display: flex;
      gap: var(--mc-space-1);
    }
    .link {
      background: transparent;
      border: 0;
      color: var(--mc-accent-primary);
      cursor: pointer;
      text-decoration: underline;
    }
    .ghost {
      background: transparent;
      border: 0;
      color: var(--mc-fg-muted);
      cursor: pointer;
    }
  `,
})
export class ReminderToastContainer {
  protected readonly scheduler = inject(ReminderSchedulerService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected goToReminders(): void {
    void this.router.navigate(['/reminders']);
    this.scheduler.dismiss();
  }
}
