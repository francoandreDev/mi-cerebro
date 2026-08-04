import { Injectable, computed, inject, signal } from '@angular/core';

import type { LoggedErrorRecord } from '@core/idb/idb.types';
import { IdbService } from '@core/idb/idb.service';

import { AppError } from './app-error';
import { ERROR_CODES } from './error.codes';
import type { ErrorContext } from './error.types';

// why: blocking modal needs full attention; toast queue stays out of the way.
const MODAL_SEVERITIES = new Set(['error', 'fatal'] as const);

// why: debug aid only (§3) — enough to spot a recurring failure, not a full audit log.
const MAX_LOGGED_ERRORS = 50;
const ERROR_LOG_KEY = 'recent';

interface ToastEntry {
  readonly id: number;
  readonly error: AppError;
}

@Injectable({ providedIn: 'root' })
export class ErrorService {
  private readonly idb = inject(IdbService);

  private nextId = 1;
  // why: report() fires persistToLog() without awaiting, so concurrent
  //      calls would otherwise all read the same "existing" log before any
  //      write lands, silently dropping entries. Chaining onto this queue
  //      serializes the read-modify-write instead.
  private logQueue: Promise<void> = Promise.resolve();

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
    this.logQueue = this.logQueue.then(() => this.persistToLog(wrapped));
  }

  /** Last logged errors, newest first — for a future debug panel. */
  async recentLog(): Promise<readonly LoggedErrorRecord[]> {
    const log = await this.idb.get<readonly LoggedErrorRecord[]>('error-log', ERROR_LOG_KEY);
    return log ? [...log].reverse() : [];
  }

  // why: ~20 scan sites across features skip a corrupt/unreadable entry per
  //      item so the rest of the workspace still loads (rule 20). Rule 28
  //      requires that skip to stay visible, but one modal/toast per bad
  //      file would be worse UX than the console.warn it replaces — so
  //      scans accumulate a count and call this once, after the loop, for
  //      a single aggregated toast instead of one AppError per file.
  reportSkippedEntries(count: number, context?: ErrorContext): void {
    if (count <= 0) return;
    this.report(
      new AppError(ERROR_CODES.ENT_003, {
        severity: 'warning',
        context: { count, ...context },
      }),
    );
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
    console.error(
      `[${error.code}] ${error.messageKey}`,
      { severity: error.severity, context: error.context, cause: error.cause },
      error,
    );
  }

  // why: best-effort only — a debug aid must never itself surface an error
  //      (would recurse into report()) or block the report() call site.
  private async persistToLog(error: AppError): Promise<void> {
    const record: LoggedErrorRecord = {
      code: error.code,
      message: error.message,
      severity: error.severity,
      context: this.safeStringify(error.context),
      loggedAt: new Date().toISOString(),
    };
    try {
      const existing =
        (await this.idb.get<readonly LoggedErrorRecord[]>('error-log', ERROR_LOG_KEY)) ?? [];
      const trimmed = [...existing, record].slice(-MAX_LOGGED_ERRORS);
      await this.idb.set('error-log', ERROR_LOG_KEY, trimmed);
    } catch (idbError) {
      console.warn('[ErrorService] failed to persist error-log entry', idbError);
    }
  }

  private safeStringify(context: ErrorContext | undefined): string | undefined {
    if (!context) return undefined;
    try {
      return JSON.stringify(context);
    } catch {
      return '"<unserializable context>"';
    }
  }
}
