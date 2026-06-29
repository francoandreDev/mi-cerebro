// why: persistencia de preferencias de la estantería en localStorage —
//      densidad (normal/compact) y conjunto de estantes colapsados. Ambos
//      son estado de UI, no de datos: no van al FS ni al índice.

export const DENSITY_KEY = 'mc.books.shelf.density';
export const COLLAPSED_KEY = 'mc.books.shelf.collapsed';

export const loadDensity = (): 'normal' | 'compact' => {
  const v = localStorage.getItem(DENSITY_KEY);
  return v === 'compact' ? 'compact' : 'normal';
};

export const loadCollapsed = (): ReadonlySet<string> => {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY) ?? '[]';
    const arr = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
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
