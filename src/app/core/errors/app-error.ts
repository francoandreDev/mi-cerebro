import type { ErrorCode } from './error.codes';
import { ERROR_CODE_META } from './error.codes';
import type { ErrorAction, ErrorContext, ErrorSeverity } from './error.types';

interface AppErrorInit {
  readonly severity: ErrorSeverity;
  readonly cause?: unknown;
  readonly context?: ErrorContext;
  readonly recoverable?: boolean;
  readonly actions?: readonly ErrorAction[];
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly titleKey: string;
  readonly messageKey: string;
  readonly severity: ErrorSeverity;
  readonly context: ErrorContext | undefined;
  readonly recoverable: boolean;
  readonly actions: readonly ErrorAction[];

  constructor(code: ErrorCode, init: AppErrorInit) {
    const meta = ERROR_CODE_META[code];
    super(`${code}: ${meta.messageKey}`);
    this.name = 'AppError';
    this.code = code;
    this.titleKey = meta.titleKey;
    this.messageKey = meta.messageKey;
    this.severity = init.severity;
    this.context = init.context;
    this.recoverable = init.recoverable ?? false;
    this.actions = init.actions ?? [];
    if (init.cause !== undefined) {
      this.cause = init.cause;
    }
  }
}
