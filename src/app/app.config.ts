import { provideBrowserGlobalErrorListeners, isDevMode } from '@angular/core';
import type { ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';
import { provideNativeFs } from './core/fs/native-fs.providers';
import { detectPlatform } from './core/platform/platform.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // why: Tauri/Capacitor serve from their own custom schemes (tauri://,
    //      capacitor://) and ship their own offline bundling — a service
    //      worker there is redundant at best and can interfere with the
    //      native IPC bridge at worst, so it's gated to real browser/PWA.
    //      detectPlatform() (not PlatformService) because this provider is
    //      built before there's an injector to pull the service from.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode() && detectPlatform() === 'browser',
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideNativeFs(),
  ],
};
