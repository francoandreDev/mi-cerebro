// why: jsdom has no IndexedDB; fake-indexeddb gives us an in-memory
//      implementation so IDB-touching services can be unit-tested.
import 'fake-indexeddb/auto';

// why: jsdom doesn't implement matchMedia; ThemeService reads it on construct.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
