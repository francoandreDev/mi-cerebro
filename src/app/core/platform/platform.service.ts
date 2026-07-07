import { Injectable } from '@angular/core';

export type RuntimePlatform = 'browser' | 'tauri' | 'capacitor';

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
}

// why: both globals are injected by their respective webview shell before
//      any app code runs (Tauri's '__TAURI_INTERNALS__' since v2, Capacitor's
//      `window.Capacitor` on native builds), so this is safe to read
//      synchronously at construction time — no async race with bootstrap.
// why: exported (not just used internally) so app.config.ts can gate the
//      service worker provider on it — that runs at providers-array
//      construction time, before there's an injector to `inject(PlatformService)`
//      from, so it needs the plain function instead.
export function detectPlatform(): RuntimePlatform {
  if (typeof window === 'undefined') return 'browser';
  if ('__TAURI_INTERNALS__' in window) return 'tauri';
  const capacitor = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  if (capacitor?.isNativePlatform?.()) return 'capacitor';
  return 'browser';
}

// why: single detection point every future native-only feature (§19
//      yt-dlp sidecar, MediaSession/notification wiring) branches on, so
//      nothing else in the app needs its own platform sniffing.
@Injectable({ providedIn: 'root' })
export class PlatformService {
  readonly current: RuntimePlatform = detectPlatform();

  get isNative(): boolean {
    return this.current !== 'browser';
  }
}
