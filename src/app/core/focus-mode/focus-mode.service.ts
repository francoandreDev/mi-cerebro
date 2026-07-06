import { DestroyRef, Injectable, inject, signal } from '@angular/core';

import { ShortcutsService } from '@core/shortcuts/shortcuts.service';

@Injectable({ providedIn: 'root' })
export class FocusModeService {
  private readonly state = signal(false);
  readonly active = this.state.asReadonly();

  constructor() {
    const shortcuts = inject(ShortcutsService);
    const dispose = shortcuts.register({
      combo: 'F11',
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
