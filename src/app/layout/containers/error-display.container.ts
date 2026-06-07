import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ErrorService } from '@core/errors/error.service';

import { ErrorModalComponent } from '../components/error-modal.component';
import { ErrorToastComponent } from '../components/error-toast.component';

@Component({
  selector: 'mc-error-display',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ErrorToastComponent, ErrorModalComponent],
  template: `
    <div class="toasts" aria-live="polite">
      @for (entry of errors.toasts(); track entry.id) {
        <mc-error-toast [error]="entry.error" (dismiss)="errors.dismissToast(entry.id)" />
      }
    </div>
    @if (errors.modal(); as modalError) {
      <mc-error-modal [error]="modalError" (dismiss)="errors.dismissModal()" />
    }
  `,
  styles: `
    .toasts {
      position: fixed;
      bottom: var(--mc-space-4);
      right: var(--mc-space-4);
      display: flex;
      flex-direction: column;
      gap: var(--mc-space-2);
      z-index: 999;
    }
  `,
})
export class ErrorDisplayContainer {
  protected readonly errors = inject(ErrorService);
}
