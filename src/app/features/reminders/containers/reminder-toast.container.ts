import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { ReminderSchedulerService } from '@core/reminders/reminder-scheduler.service';
import type { ReminderSummary } from '../models/reminder.types';
import { IconComponent } from '@shared/icon/icon.component';
import type { IconName } from '@shared/icon/icons.data';

@Component({
  selector: 'mc-reminder-toast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (scheduler.active(); as r) {
      <div role="status" class="toast">
        <div class="body">
          <strong>
            <mc-icon [name]="iconFor(r)" />
            {{ titleFor(r) }}
          </strong>
          <span class="title">{{ r.title || t('reminders.untitled') }}</span>
        </div>
        <div class="actions">
          <button type="button" class="link" (click)="open(r)">
            {{ t('reminders.toast.open') }}
          </button>
          <button type="button" class="ghost" (click)="scheduler.dismiss()" aria-label="Cerrar">
            <mc-icon name="x" />
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

  protected iconFor(r: ReminderSummary): IconName {
    return r.sourceKind === 'goal' ? 'target' : 'bell';
  }

  protected titleFor(r: ReminderSummary): string {
    return r.sourceKind === 'goal'
      ? this.t('reminders.toast.goalTitle')
      : this.t('reminders.toast.title');
  }

  protected open(r: ReminderSummary): void {
    if (r.sourceKind === 'goal' && r.sourceId) {
      void this.router.navigate(['/goals', r.sourceId]);
    } else {
      void this.router.navigate(['/reminders']);
    }
    this.scheduler.dismiss();
  }
}
