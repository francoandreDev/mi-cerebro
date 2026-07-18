import { Injectable } from '@angular/core';

import { autoScrollOnDragEdge, findScrollableAncestor } from './drag-auto-scroll';

// why: wired once at app root (see AppShellContainer) so every drag-and-drop
// interaction in the app gets edge-scroll for free instead of each feature
// wiring its own dragover listener. Applies to any native HTML5 drag —
// gated only on `dataTransfer` existing, not on a specific MIME type.
@Injectable({ providedIn: 'root' })
export class DragAutoScrollService {
  start(): void {
    document.addEventListener('dragover', this.onDragOver);
  }

  private readonly onDragOver = (event: DragEvent): void => {
    if (!event.dataTransfer) return;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const scrollable = findScrollableAncestor(target);
    if (scrollable) autoScrollOnDragEdge(scrollable, event.clientX, event.clientY);
  };
}
