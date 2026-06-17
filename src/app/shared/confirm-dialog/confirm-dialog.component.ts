import type { ElementRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';

export interface ConfirmRequest {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly tone?: 'default' | 'danger';
}

@Component({
  selector: 'mc-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // why: render fuera del flujo para no afectar el layout del padre.
  host: { style: 'display: contents' },
  template: `
    @if (request(); as req) {
      <button
        type="button"
        class="backdrop"
        [attr.aria-label]="req.cancelLabel"
        (click)="cancelled.emit()"
      ></button>
      <div
        class="dialog"
        role="alertdialog"
        aria-modal="true"
        [attr.aria-labelledby]="titleId"
        [attr.aria-describedby]="msgId"
        (keydown.escape)="cancelled.emit()"
        (keydown.enter)="confirmed.emit()"
      >
        <h3 [id]="titleId">{{ req.title }}</h3>
        <p [id]="msgId">{{ req.message }}</p>
        <div class="actions">
          <button type="button" class="ghost" (click)="cancelled.emit()">
            {{ req.cancelLabel }}
          </button>
          <button
            #confirmBtn
            type="button"
            [class]="req.tone === 'danger' ? 'danger' : 'primary'"
            (click)="confirmed.emit()"
          >
            {{ req.confirmLabel }}
          </button>
        </div>
      </div>
    }
  `,
  styleUrl: './confirm-dialog.component.css',
})
export class ConfirmDialogComponent {
  readonly request = input<ConfirmRequest | null>(null);
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  protected readonly titleId = 'mc-confirm-title';
  protected readonly msgId = 'mc-confirm-msg';
  private readonly confirmBtn = viewChild<ElementRef<HTMLButtonElement>>('confirmBtn');

  constructor() {
    effect(() => {
      if (this.request()) queueMicrotask(() => this.confirmBtn()?.nativeElement.focus());
    });
  }
}
