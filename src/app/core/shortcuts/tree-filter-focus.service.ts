import { DestroyRef, Injectable, inject } from '@angular/core';

import { ShortcutsService } from './shortcuts.service';

// why: Ctrl+P used to be registered inside TreeFilterComponent, but that
//      component only mounts in routes where the sidebar pane is visible
//      (PANE_HIDDEN_PREFIXES hides it on most redesigned pages). Without a
//      handler registered, the browser's print dialog opens. This service
//      lives at root and always claims Ctrl+P / '/', dispatching to whichever
//      tree-filter is mounted (or no-op if none).
@Injectable({ providedIn: 'root' })
export class TreeFilterFocusService {
  private handler: (() => void) | null = null;

  constructor() {
    const shortcuts = inject(ShortcutsService);
    const disposers = [
      shortcuts.register({
        combo: 'Ctrl+P',
        labelKey: 'shortcuts.treeFilter',
        scope: 'global',
        handler: () => this.handler?.(),
      }),
      shortcuts.register({
        combo: '/',
        labelKey: 'shortcuts.treeFilter',
        scope: 'editable-safe',
        handler: () => this.handler?.(),
      }),
    ];
    inject(DestroyRef).onDestroy(() => {
      for (const d of disposers) d();
    });
  }

  setHandler(handler: (() => void) | null): void {
    this.handler = handler;
  }
}
