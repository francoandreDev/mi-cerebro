import { AppError } from './app-error';
import { ERROR_CODES } from './error.codes';

// why: every container that writes to disk needs to recover from a dropped
//      FS permission with a "Reautorizar" action. Pulling the shape into a
//      shared helper keeps containers under their line budget and ensures
//      consistent UX across features.
export const withReauthIfNeeded = (
  error: unknown,
  reauthorize: () => Promise<void>,
  retry?: () => void,
): unknown => {
  if (!(error instanceof AppError) || error.code !== ERROR_CODES.FS_004) return error;
  return new AppError(ERROR_CODES.FS_004, {
    severity: 'warning',
    recoverable: true,
    cause: error.cause,
    ...(error.context !== undefined ? { context: error.context } : {}),
    actions: [
      {
        labelKey: 'common.reauthorize',
        run: async () => {
          await reauthorize();
          retry?.();
        },
      },
    ],
  });
};
