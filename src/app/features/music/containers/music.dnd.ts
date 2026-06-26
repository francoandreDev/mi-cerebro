export const TRACK_DRAG_MIME = 'application/x-mc-track-ids';

export function hasFiles(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  if (!types) return false;
  for (const t of types) if (t === 'Files') return true;
  return false;
}

export function hasTrackDrag(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  if (!types) return false;
  for (const t of types) if (t === TRACK_DRAG_MIME) return true;
  return false;
}

export function parseTrackDragPayload(event: DragEvent): readonly string[] {
  const raw = event.dataTransfer?.getData(TRACK_DRAG_MIME) ?? '';
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    return [];
  }
}
