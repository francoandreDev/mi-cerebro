export const TRACK_DRAG_MIME = 'application/x-mc-track-ids';

export function hasFiles(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  if (!types) return false;
  for (const t of types) if (t === 'Files') return true;
  return false;
}
