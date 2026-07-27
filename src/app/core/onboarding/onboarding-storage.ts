// why: side-car UI state, not domain data — same reasoning as
//      dashboard-resurface-storage.ts / tutorial-storage.ts. All I/O is
//      best-effort: a blocked/unavailable localStorage must never break the
//      checklist, it just means "dismissed" doesn't stick across reloads.
const STORAGE_KEY = 'mc.onboarding.dismissed.v1';

export const loadOnboardingDismissed = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

export const saveOnboardingDismissed = (dismissed: boolean): void => {
  try {
    if (dismissed) {
      localStorage.setItem(STORAGE_KEY, '1');
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* no-op */
  }
};
