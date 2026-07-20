// why: side-car UI state, not domain data — kept out of the workspace FS on
//      purpose (see docs/deferred/dashboard-evolution.md decision log). All
//      I/O is best-effort, same pattern as ContinuityService: failures fall
//      back to an empty/no-op rather than surfacing an error for a
//      non-essential feature.
const STORAGE_KEY = 'mc.dashboard.resurfaceExcluded.v1';
const DAY_MS = 24 * 60 * 60 * 1000;

type ExcludedMap = Readonly<Record<string, number>>;

// why: a Map (not a Set) so each id keeps its own original exclusion
//      timestamp across saves — re-saving the whole set on every shuffle
//      must not reset an older entry's TTL clock back to "now".
export const loadResurfaceExcluded = (
  nowMs: number,
  ttlDays: number,
): ReadonlyMap<string, number> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const map = JSON.parse(raw) as ExcludedMap;
    const cutoff = nowMs - ttlDays * DAY_MS;
    return new Map(Object.entries(map).filter(([, excludedAt]) => excludedAt > cutoff));
  } catch {
    return new Map();
  }
};

export const saveResurfaceExcluded = (excluded: ReadonlyMap<string, number>): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(excluded)));
  } catch {
    /* no-op */
  }
};
