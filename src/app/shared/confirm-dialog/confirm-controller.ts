import { signal } from '@angular/core';

import type { ConfirmRequest } from './confirm-dialog.component';

export class ConfirmController {
  private readonly requestSignal = signal<ConfirmRequest | null>(null);
  readonly request = this.requestSignal.asReadonly();
  private handler: (() => void | Promise<void>) | null = null;

  ask(req: ConfirmRequest, onAccept: () => void | Promise<void>): void {
    this.handler = onAccept;
    this.requestSignal.set(req);
  }

  accept(): void {
    const handler = this.handler;
    this.requestSignal.set(null);
    this.handler = null;
    if (handler) void handler();
  }

  cancel(): void {
    this.requestSignal.set(null);
    this.handler = null;
  }
}
