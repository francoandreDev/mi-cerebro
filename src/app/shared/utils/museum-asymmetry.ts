// why: layout asimétrico determinístico para los cuadros del museo.
//      Mismo imageId → mismo tamaño y offset vertical en cualquier sesión,
//      sin guardar nada en el JSON de la galería.

const djb2 = (seed: string): number => {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 33) ^ seed.charCodeAt(i);
  }
  return h >>> 0;
};

export type FrameSize = 'S' | 'M' | 'L';

export interface FrameLayout {
  readonly size: FrameSize;
  readonly offsetY: number;
}

const SIZE_BUCKETS: readonly FrameSize[] = ['S', 'M', 'L', 'M', 'M', 'L', 'S', 'M'];

export const getFrameLayout = (imageId: string): FrameLayout => {
  const h = djb2(imageId);
  const size = SIZE_BUCKETS[h % SIZE_BUCKETS.length] ?? 'M';
  const offsetY = ((h >> 8) % 25) - 12;
  return { size, offsetY };
};

export const FRAME_WIDTH_PX: Readonly<Record<FrameSize, number>> = {
  S: 180,
  M: 240,
  L: 320,
};

export const ROOM_SIZE = 25;

interface Orderable {
  readonly id: string;
}

export const orderItems = <T extends Orderable>(
  items: readonly T[],
  order: readonly string[],
): readonly T[] => {
  const byId = new Map(items.map((i) => [i.id, i] as const));
  const ordered: T[] = [];
  for (const id of order) {
    const item = byId.get(id);
    if (item) {
      ordered.push(item);
      byId.delete(id);
    }
  }
  for (const item of byId.values()) ordered.push(item);
  return ordered;
};

export const paginateCuartos = <T>(
  items: readonly T[],
  size: number = ROOM_SIZE,
): readonly (readonly T[])[] => {
  if (items.length === 0) return [[]];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
};
