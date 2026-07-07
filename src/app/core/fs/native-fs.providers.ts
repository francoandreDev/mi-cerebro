import { inject } from '@angular/core';
import type { Provider } from '@angular/core';

import { PlatformService } from '@core/platform/platform.service';

import { BrowserNativeFs } from './adapters/browser-native-fs';
import { CapacitorNativeFs } from './adapters/capacitor-native-fs';
import { TauriNativeFs } from './adapters/tauri-native-fs';
import { NATIVE_FS } from './native-fs';

// why: single place that switches the NativeFs implementation on the
//      detected runtime platform, so app.config.ts stays a plain list of
//      providers instead of embedding this branch inline.
export function provideNativeFs(): Provider {
  return {
    provide: NATIVE_FS,
    useFactory: () => {
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
