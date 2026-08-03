// Tiny sessionStorage read/write helpers shared by the history container and
// its per-zoom components — several small pieces of "visible range" state
// (panorama selected day, compact-diff toggle, etc.) persist independently
// per key so revisiting /history is instant. Private/incognito mode can
// throw on storage access, so every call is best-effort.

export function readSS(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSS(key: string, value: string | null): void {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // why: private mode can throw; rango es un nice-to-have.
  }
}
