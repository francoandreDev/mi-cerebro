import { Injectable, computed, signal } from '@angular/core';

import { AppError } from './app-error';
import { ERROR_CODES } from './error.codes';

// why: blocking modal needs full attention; toast queue stays out of the way.
const MODAL_SEVERITIES = new Set(['error', 'fatal'] as const);

interface ToastEntry {
  readonly id: number;
  readonly error: AppError;
}

@Injectable({ providedIn: 'root' })
export class ErrorService {
  private nextId = 1;

  private readonly modalSignal = signal<AppError | null>(null);
  private readonly toastsSignal = signal<readonly ToastEntry[]>([]);

  readonly modal = this.modalSignal.asReadonly();
  readonly toasts = this.toastsSignal.asReadonly();
  readonly hasModal = computed(() => this.modalSignal() !== null);

  report(error: unknown): void {
    const wrapped = this.wrap(error);
    this.logToConsole(wrapped);
    if (MODAL_SEVERITIES.has(wrapped.severity as 'error' | 'fatal')) {
      this.modalSignal.set(wrapped);
    } else {
      this.pushToast(wrapped);
    }
    // TODO: persist last N to IndexedDB once IdbService exists (step 4).
  }

  dismissModal(): void {
    this.modalSignal.set(null);
  }

  dismissToast(id: number): void {
    this.toastsSignal.update((list) => list.filter((t) => t.id !== id));
  }

  private wrap(error: unknown): AppError {
    if (error instanceof AppError) return error;
    return new AppError(ERROR_CODES.SYS_001, {
      severity: 'error',
      cause: error,
    });
  }

  private pushToast(error: AppError): void {
    const id = this.nextId++;
    this.toastsSignal.update((list) => [...list, { id, error }]);
  }

  private logToConsole(error: AppError): void {
    console.error(`[${error.code}] ${error.messageKey}`, {
      severity: error.severity,
      context: error.context,
      cause: error.cause,
    });
  }
}
