import { DestroyRef, Injectable, inject, signal } from '@angular/core';

import { ShortcutsService } from '@core/shortcuts/shortcuts.service';

@Injectable({ providedIn: 'root' })
export class FocusModeService {
  private readonly state = signal(false);
  readonly active = this.state.asReadonly();

  constructor() {
    const shortcuts = inject(ShortcutsService);
    // why: F11 is native browser fullscreen — Chrome/Firefox don't let JS
    // preventDefault() it reliably, so it toggled our state AND the OS
    // window chrome at once. Alt+Shift+F doesn't collide with any browser
    // default (see docs/deferred/shortcuts-cross-section.md).
    const dispose = shortcuts.register({
      combo: 'Alt+Shift+F',
      labelKey: 'shortcuts.focusMode',
      scope: 'global',
      handler: () => this.toggle(),
    });
    inject(DestroyRef).onDestroy(dispose);
  }

  toggle(): void {
    this.state.update((v) => !v);
  }

  disable(): void {
    this.state.set(false);
  }
}
