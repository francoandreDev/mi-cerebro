import { Injectable, signal } from '@angular/core';

// Why: a tiny singleton so any keybind handler can toggle the palette
//      without owning the UI component. The container subscribes to `open`.
@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  private readonly openSignal = signal(false);
  readonly open = this.openSignal.asReadonly();

  show(): void {
    this.openSignal.set(true);
  }

  hide(): void {
    this.openSignal.set(false);
  }

  toggle(): void {
    this.openSignal.update((v) => !v);
  }
}
