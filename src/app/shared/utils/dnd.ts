// why: shared by every list/grid that supports drag-and-drop reordering.
//      Items use a custom mime type so OS-file drops (which carry
//      `dataTransfer.files`) and internal item drags don't get confused.
export const MC_INTERNAL_DND_TYPE = 'application/x-mc-id';

export const hasInternalDnd = (event: DragEvent): boolean =>
  Array.from(event.dataTransfer?.types ?? []).includes(MC_INTERNAL_DND_TYPE);
