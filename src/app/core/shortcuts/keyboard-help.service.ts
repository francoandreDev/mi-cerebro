import { DestroyRef, Injectable, inject, signal } from '@angular/core';

import { ShortcutsService } from './shortcuts.service';

// why: el diálogo de ayuda de atajos necesita abrirse tanto desde su propio
//      combo ('?') como desde un botón en la sidebar — mismo patrón que
//      QuickCaptureService: el estado vive acá, el diálogo solo lo lee.
@Injectable({ providedIn: 'root' })
export class KeyboardHelpService {
  private readonly shortcuts = inject(ShortcutsService);

  private readonly openSignal = signal(false);
  readonly open = this.openSignal.asReadonly();

  constructor() {
    const dispose = this.shortcuts.register({
      combo: '?',
      labelKey: 'shortcuts.help.open',
      scope: 'editable-safe',
      handler: () => this.openDialog(),
    });
    inject(DestroyRef).onDestroy(dispose);
  }

  openDialog(): void {
    this.openSignal.set(true);
  }

  closeDialog(): void {
    this.openSignal.set(false);
  }
}
