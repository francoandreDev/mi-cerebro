const EDGE_ZONE_PX = 48;
const MAX_SCROLL_STEP_PX = 18;

// why: rather than wiring scroll-edge detection into every draggable/drop
// pair in the app (music tracks→playlists, tasks kanban, bookshelf, museum
// gallery, chalk layers, file grid, ...), walk up from the element under the
// cursor to find whatever scrollable ancestor is actually there. Matches the
// "drag near an edge, whatever's there scrolls" behavior of native browser
// selection drag.
export function findScrollableAncestor(el: Element | null): HTMLElement | null {
  let node = el instanceof HTMLElement ? el : null;
  while (node) {
    const style = getComputedStyle(node);
    const scrollsY =
      (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
      node.scrollHeight > node.clientHeight;
    const scrollsX =
      (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
      node.scrollWidth > node.clientWidth;
    if (scrollsY || scrollsX) return node;
    node = node.parentElement;
  }
  return null;
}

// why: native HTML5 drag doesn't auto-scroll like a native OS drag does, so
// nudge scrollTop/scrollLeft on every dragover fired near a container's
// edges — speed ramps up closer to the edge. Each axis only moves if the
// container actually overflows that axis.
export function autoScrollOnDragEdge(
  container: HTMLElement,
  clientX: number,
  clientY: number,
): void {
  if (container.scrollHeight > container.clientHeight) {
    const rect = container.getBoundingClientRect();
    const distTop = clientY - rect.top;
    const distBottom = rect.bottom - clientY;
    if (distTop < EDGE_ZONE_PX) {
      container.scrollTop -= MAX_SCROLL_STEP_PX * (1 - distTop / EDGE_ZONE_PX);
    } else if (distBottom < EDGE_ZONE_PX) {
      container.scrollTop += MAX_SCROLL_STEP_PX * (1 - distBottom / EDGE_ZONE_PX);
    }
  }
  if (container.scrollWidth > container.clientWidth) {
    const rect = container.getBoundingClientRect();
    const distLeft = clientX - rect.left;
    const distRight = rect.right - clientX;
    if (distLeft < EDGE_ZONE_PX) {
      container.scrollLeft -= MAX_SCROLL_STEP_PX * (1 - distLeft / EDGE_ZONE_PX);
    } else if (distRight < EDGE_ZONE_PX) {
      container.scrollLeft += MAX_SCROLL_STEP_PX * (1 - distRight / EDGE_ZONE_PX);
    }
  }
}
