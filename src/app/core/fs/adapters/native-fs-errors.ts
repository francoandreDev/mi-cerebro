import { AppError } from '@core/errors/app-error';
import { ERROR_CODES, type ErrorCode } from '@core/errors/error.codes';

// why: NotAllowedError means the browser dropped readwrite permission
//      between the last successful queryPermission and this call. Routing
//      it to FS-004 lets the UI surface a reauthorize action instead of the
//      generic write-failure message. SecurityError shows up the same way on
//      some Chromium versions when the user closed the FS picker mid-request,
//      so we treat it as a permission case too. Shared by every adapter
//      (browser, Tauri, Capacitor) so the reauth mapping lives in one place
//      instead of being duplicated per platform. `fallback` lets each
//      adapter pick its own generic-IO-failure code (FS-001 browser,
//      FS-005 Tauri, FS-006 Capacitor) since the same DOMException-less
//      failure means a different subsystem on each platform.
export function classifyFsError(
  cause: unknown,
  context: Record<string, unknown>,
  fallback: ErrorCode = ERROR_CODES.FS_001,
): AppError {
  if (cause instanceof DOMException) {
    const name = cause.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return new AppError(ERROR_CODES.FS_004, {
        severity: 'warning',
        cause,
        context,
        recoverable: true,
      });
    }
  }
  return new AppError(fallback, {
    severity: 'error',
    cause,
    context,
  });
}
