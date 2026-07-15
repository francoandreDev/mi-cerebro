// why: persistencia de preferencias de la estantería en localStorage —
//      sólo densidad (normal/compact) hoy. Estado de UI, no de datos: no va
//      al FS ni al índice.

export const DENSITY_KEY = 'mc.books.shelf.density';

export const loadDensity = (): 'normal' | 'compact' => {
  const v = localStorage.getItem(DENSITY_KEY);
  return v === 'compact' ? 'compact' : 'normal';
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
