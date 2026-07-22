// why: side-car UI state, not domain data — same reasoning as
//      dashboard-resurface-storage.ts. Best-effort: a blocked/unavailable
//      localStorage must never break the tutorial itself, it just means it
//      re-shows next time instead of remembering "seen".
const STORAGE_KEY = 'mc.tutorial.seen.v1';

type SeenMap = Readonly<Record<string, true>>;

const readSeenMap = (): SeenMap => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as SeenMap;
  } catch {
    return {};
  }
};

export const hasSeenTutorial = (id: string): boolean => Boolean(readSeenMap()[id]);

export const markTutorialSeen = (id: string): void => {
  try {
    const seen = { ...readSeenMap(), [id]: true as const };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
  } catch {
    /* no-op */
  }
};
