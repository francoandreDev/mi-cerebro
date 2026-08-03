import { inject } from '@angular/core';
import type { Provider } from '@angular/core';

import { PlatformService } from '@core/platform/platform.service';

import { BrowserNativeFs } from './adapters/browser-native-fs';
import { CapacitorNativeFs } from './adapters/capacitor-native-fs';
import { E2eNativeFs } from './adapters/e2e-native-fs';
import { TauriNativeFs } from './adapters/tauri-native-fs';
import { NATIVE_FS } from './native-fs';

// why: `window.__E2E_FS__` is set only by Playwright's init script (see
//      e2e/support/e2e-fs.ts) before the app boots — never in a real
//      browser session — to swap in the in-memory adapter and skip the
//      unautomatable native showDirectoryPicker() dialog. Checked ahead of
//      the platform switch so it wins even though PlatformService.current
//      is still 'browser' under Playwright's Chromium.
function isE2eFs(): boolean {
  return typeof window !== 'undefined' && (window as { __E2E_FS__?: boolean }).__E2E_FS__ === true;
}

// why: single place that switches the NativeFs implementation on the
//      detected runtime platform, so app.config.ts stays a plain list of
//      providers instead of embedding this branch inline.
export function provideNativeFs(): Provider {
  return {
    provide: NATIVE_FS,
    useFactory: () => {
      if (isE2eFs()) return inject(E2eNativeFs);
      const platform = inject(PlatformService);
      switch (platform.current) {
        case 'tauri':
          return inject(TauriNativeFs);
        case 'capacitor':
          return inject(CapacitorNativeFs);
        default:
          return inject(BrowserNativeFs);
      }
    },
  };
}
