// why: persistencia de preferencias de la estantería en localStorage —
//      densidad (normal/compact) y estantes anclados. Estado de UI, no de
//      datos: no va al FS ni al índice.

export const DENSITY_KEY = 'mc.books.shelf.density';

export const loadDensity = (): 'normal' | 'compact' => {
  const v = localStorage.getItem(DENSITY_KEY);
  return v === 'compact' ? 'compact' : 'normal';
};

export const PINNED_FOLDERS_KEY = 'mc.books.shelf.pinnedFolders';

export const loadPinnedFolders = (): ReadonlySet<string> => {
  try {
    const raw = localStorage.getItem(PINNED_FOLDERS_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === 'string'));
  } catch {
    return new Set();
  }
};

export const savePinnedFolders = (folders: ReadonlySet<string>): void => {
  localStorage.setItem(PINNED_FOLDERS_KEY, JSON.stringify([...folders]));
};

// why: bfcache puede restaurar la página con el input del DOM vacío pero un
//      signal con el último valor tipeado — quedando un filter "fantasma"
//      sin afford visible para sacarlo. Al detectar restore desde bfcache
//      (`event.persisted === true`), llamamos `reset()` para resincronizar.
//      Devuelve la función de cleanup (para colgar de DestroyRef.onDestroy).
export const wireBfcacheReset = (reset: () => void): (() => void) => {
  const handler = (e: PageTransitionEvent): void => {
    if (e.persisted) reset();
  };
  window.addEventListener('pageshow', handler);
  return () => window.removeEventListener('pageshow', handler);
};
