// why: jsdom has no IndexedDB; fake-indexeddb gives us an in-memory
//      implementation so IDB-touching services can be unit-tested.
import 'fake-indexeddb/auto';

// why: in this test environment `window` and `globalThis` are the same
//      object, so vitest's jsdom setup skips populating `localStorage`
//      (it already exists — Node 20.12+ defines it as a built-in global).
//      That built-in getter is disabled unless run with
//      --localstorage-file, so `typeof localStorage` resolves to
//      'undefined' at runtime. jsdom's own Storage impl also isn't usable
//      as a substitute here since our test URL is an opaque origin
//      ('about:blank'), which jsdom refuses to back with storage. A tiny
//      in-memory Storage polyfill sidesteps both problems.
if (typeof globalThis.localStorage === 'undefined') {
  const makeMemoryStorage = (): Storage => {
    const store = new Map<string, string>();
    return {
      get length() {
        return store.size;
      },
      clear: () => store.clear(),
      getItem: (key) => (store.has(key) ? (store.get(key) ?? null) : null),
      key: (index) => Array.from(store.keys())[index] ?? null,
      removeItem: (key) => {
        store.delete(key);
      },
      setItem: (key, value) => {
        store.set(key, String(value));
      },
    };
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: makeMemoryStorage(),
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: makeMemoryStorage(),
    configurable: true,
    writable: true,
  });
}

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
