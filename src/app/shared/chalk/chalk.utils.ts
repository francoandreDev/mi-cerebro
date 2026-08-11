import { toSlug } from '@shared/utils/slug';

import type { ChalkLayer, ChalkStroke } from './chalk.types';
import { CHALK_COLORS, CHALK_SIZE_PX, ERASER_RADIUS_PX, newChalkLayer } from './chalk.types';

export const ensureActiveLayer = (
  layers: readonly ChalkLayer[],
  activeId: string | null,
  defaultName: string,
): { layers: readonly ChalkLayer[]; activeId: string } => {
  const writable = layers.find((l) => l.id === activeId && !l.locked && l.visible);
  if (writable) return { layers, activeId: writable.id };
  const candidate = layers.find((l) => !l.locked && l.visible);
  if (candidate) return { layers, activeId: candidate.id };
  const created = newChalkLayer(defaultName);
  return { layers: [...layers, created], activeId: created.id };
};

export const pushStroke = (
  layers: readonly ChalkLayer[],
  layerId: string,
  stroke: ChalkStroke,
): readonly ChalkLayer[] =>
  layers.map((l) => (l.id === layerId ? { ...l, strokes: [...l.strokes, stroke] } : l));

export const eraseAt = (
  layers: readonly ChalkLayer[],
  layerId: string,
  point: readonly [number, number],
  boardWidthPx: number,
  boardHeightPx: number,
): readonly ChalkLayer[] => {
  const rxN = boardWidthPx > 0 ? ERASER_RADIUS_PX / boardWidthPx : 0;
  const ryN = boardHeightPx > 0 ? ERASER_RADIUS_PX / boardHeightPx : 0;
  return layers.map((l) => {
    if (l.id !== layerId) return l;
    const next = l.strokes.filter((s) => !strokeHitsEllipse(s, point, rxN, ryN));
    if (next.length === l.strokes.length) return l;
    return { ...l, strokes: next };
  });
};

const strokeHitsEllipse = (
  stroke: ChalkStroke,
  [cx, cy]: readonly [number, number],
  rx: number,
  ry: number,
): boolean => {
  for (const [x, y] of stroke.points) {
    const dx = (x - cx) / Math.max(rx, 1e-6);
    const dy = (y - cy) / Math.max(ry, 1e-6);
    if (dx * dx + dy * dy <= 1) return true;
  }
  return false;
};

export const renameLayer = (
  layers: readonly ChalkLayer[],
  id: string,
  name: string,
): readonly ChalkLayer[] =>
  layers.map((l) => (l.id === id ? { ...l, name: name.trim() || l.name } : l));

export const toggleLayerVisible = (
  layers: readonly ChalkLayer[],
  id: string,
): readonly ChalkLayer[] => layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l));

export const toggleLayerLocked = (
  layers: readonly ChalkLayer[],
  id: string,
): readonly ChalkLayer[] => layers.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l));

export const removeLayer = (layers: readonly ChalkLayer[], id: string): readonly ChalkLayer[] =>
  layers.filter((l) => l.id !== id);

export const moveLayer = (
  layers: readonly ChalkLayer[],
  id: string,
  direction: -1 | 1,
): readonly ChalkLayer[] => {
  const idx = layers.findIndex((l) => l.id === id);
  if (idx < 0) return layers;
  const target = idx + direction;
  if (target < 0 || target >= layers.length) return layers;
  const copy = [...layers];
  const [moved] = copy.splice(idx, 1);
  copy.splice(target, 0, moved!);
  return copy;
};

export const reorderLayer = (
  layers: readonly ChalkLayer[],
  from: string,
  to: string,
): readonly ChalkLayer[] => {
  if (from === to) return layers;
  const fromIdx = layers.findIndex((l) => l.id === from);
  if (fromIdx < 0) return layers;
  const without = layers.filter((l) => l.id !== from);
  const toIdx = without.findIndex((l) => l.id === to);
  if (toIdx < 0) return layers;
  const moved = layers[fromIdx]!;
  return [...without.slice(0, toIdx), moved, ...without.slice(toIdx)];
};

export const clearLayer = (layers: readonly ChalkLayer[], id: string): readonly ChalkLayer[] =>
  layers.map((l) => (l.id === id ? { ...l, strokes: [] } : l));

export const addLayer = (
  layers: readonly ChalkLayer[],
  name: string,
): { layers: readonly ChalkLayer[]; activeId: string } => {
  const created = newChalkLayer(name);
  return { layers: [...layers, created], activeId: created.id };
};

// why: cheap "hand pressure" jitter — one deterministic pseudo-random opacity
//      per stroke (not per segment/DOM node, so it costs nothing extra on
//      long strokes) derived from the stroke's own id. Combined with the
//      single shared <filter> grain in chalk-board.component.html for the
//      "real chalk" feel (see docs/deferred/lists-images.md).
export const strokeOpacity = (id: string): number => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  const unit = (hash >>> 0) / 0xffffffff;
  return 0.82 + unit * 0.15;
};

export const pointsToPath = (points: readonly (readonly [number, number])[]): string => {
  if (points.length === 0) return '';
  let d = `M${points[0]![0].toFixed(5)} ${points[0]![1].toFixed(5)}`;
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i]!;
    d += ` L${x.toFixed(5)} ${y.toFixed(5)}`;
  }
  return d;
};

// why: on-screen strokes use viewBox "0 0 1 1" + vector-effect="non-scaling-stroke"
//      so stroke-width stays constant in screen px regardless of the board's
//      real size. A standalone export can't rely on that (no live scale
//      transform once detached), so points are baked into real px coordinates
//      here and stroke-width is written as a plain px value in the same space.
export const buildChalkExportSvg = (
  layers: readonly ChalkLayer[],
  widthPx: number,
  heightPx: number,
): string => {
  const w = Math.max(1, Math.round(widthPx));
  const h = Math.max(1, Math.round(heightPx));
  const groups = layers
    .filter((l) => l.visible)
    .map((l) => `<g>${l.strokes.map((s) => strokeToSvgPath(s, w, h)).join('')}</g>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${groups}</svg>`;
};

const strokeToSvgPath = (stroke: ChalkStroke, w: number, h: number): string => {
  const d = pointsToPath(stroke.points.map(([x, y]) => [x * w, y * h] as const));
  const hex = CHALK_COLORS.find((c) => c.id === stroke.color)?.hex ?? '#f1f5d8';
  const width = CHALK_SIZE_PX[stroke.size];
  return `<path d="${d}" stroke="${hex}" stroke-width="${width}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.92" />`;
};

export const chalkExportFilename = (title: string, ext: 'svg' | 'png'): string =>
  `${toSlug(title, 'pizarra')}.${ext}`;
