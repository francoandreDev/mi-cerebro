// Density derivation for the stratigraphic history view (v2 Fase 2). Pure
// so it stays testable outside Angular and can be reused by the future
// panorámica renderer with a different thickness scale.
//
// Real density (commit count over the *unfiltered* bucket) drives the
// thickness of the stratum header so filters and search never shrink the
// band — the geology stays honest. Facet mix comes from `facetOf` on each
// commit message; fossils are milestones anchored on any commit inside
// the bucket range.

import { facetOf, type Facet } from './facet';
import type { DayAggregate } from './history-loader.service';
import type { CommitBucket, CommitEntry, MilestoneEntry } from './history.types';

export interface StratumDensity {
  readonly totalCount: number;
  readonly facetMix: Readonly<Record<Facet, number>>;
  readonly thicknessPx: number;
  readonly fossils: readonly MilestoneEntry[];
}

// Piso legible + techo modesto en el header lineal. La cordillera de Fase
// 3 usará su propia escala (techo ~40vh) sobre el mismo `totalCount`.
const THICKNESS_MIN_PX = 20;
const THICKNESS_MAX_PX = 96;
const THICKNESS_K = 10;

export const EMPTY_DENSITY: StratumDensity = {
  totalCount: 0,
  facetMix: { main: 0, comments: 0, draft: 0 },
  thicknessPx: THICKNESS_MIN_PX,
  fossils: [],
};

export function computeDensity(
  bucket: CommitBucket,
  milestonesByOid: ReadonlyMap<string, readonly MilestoneEntry[]>,
): StratumDensity {
  let total = 0;
  const mix: Record<Facet, number> = { main: 0, comments: 0, draft: 0 };
  const fossils: MilestoneEntry[] = [];
  for (const item of bucket.items) {
    const commits: readonly CommitEntry[] = item.kind === 'commit' ? [item.entry] : item.members;
    for (const c of commits) {
      total++;
      mix[facetOf(c.message)]++;
      const ms = milestonesByOid.get(c.oid);
      if (ms) fossils.push(...ms);
    }
  }
  const raw = THICKNESS_MIN_PX + Math.log2(1 + total) * THICKNESS_K;
  const thicknessPx = Math.min(THICKNESS_MAX_PX, Math.max(THICKNESS_MIN_PX, Math.round(raw)));
  return { totalCount: total, facetMix: mix, thicknessPx, fossils };
}

// Panorama geometry (v2 Fase 3): silueta apilada por faceta como un perfil
// montañoso continuo. Cada faceta emite **un** `path.d` cerrado con curvas
// suaves (Catmull-Rom → cubic Bezier) tanto en el techo del band como en el
// piso — se lee como cordillera, no como bar chart. El DOM queda de tres
// paths, independiente de la cantidad de commits.

export interface PanoramaColumn {
  readonly x: number; // centro de la columna (para banderines y hit-test)
  readonly hitX: number; // borde izquierdo de la zona de hit-test
  readonly hitWidth: number;
  readonly dayStart: number;
  readonly count: number;
  readonly totalHeight: number;
  readonly peakY: number; // y del pico apilado total (top de draft)
}

export interface PanoramaMonthTick {
  readonly x: number; // centro del tick en coord SVG
  readonly label: string; // 'ENE', 'FEB', …
  readonly monthStart: number; // ts del primer día del mes representado
}

export interface PanoramaYTick {
  readonly count: number;
  readonly y: number; // coord SVG del tick
}

export interface PanoramaGeometry {
  readonly width: number;
  readonly height: number;
  readonly horizonY: number; // línea de horizonte
  readonly viewBox: string;
  readonly columns: readonly PanoramaColumn[];
  readonly paths: Readonly<Record<Facet, string>>;
  readonly monthTicks: readonly PanoramaMonthTick[];
  readonly maxCount: number; // pico de commits/día en el rango cargado
  // why: reference lines para leer alturas como "cuántos commits/día". No
  // decoración: el usuario compara visualmente el pico contra estos ticks
  // para saber si un día tuvo poco/mucho movimiento sin necesidad de hover.
  readonly yTicks: readonly PanoramaYTick[];
}

export interface PanoramaOptions {
  readonly columnWidth?: number;
  readonly height?: number;
  readonly minColHeight?: number;
  readonly logK?: number;
  readonly horizonPad?: number;
}

const PANORAMA_COLUMN_WIDTH = 10;
const PANORAMA_HEIGHT = 220;
const PANORAMA_MIN_H = 4;
const PANORAMA_LOG_K = 22;
const PANORAMA_HORIZON_PAD = 0;

interface Pt {
  readonly x: number;
  readonly y: number;
}

// Catmull-Rom → cubic Bezier. Devuelve la secuencia de comandos `C` que van
// desde `points[0]` hasta `points[n-1]` pasando por cada punto intermedio.
// Asume que el cursor ya está en `points[0]` (por un `M` previo).
function smoothCurve(points: readonly Pt[]): string {
  if (points.length < 2) return '';
  const parts: string[] = [];
  const n = points.length;
  for (let i = 0; i < n - 1; i++) {
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p0 = points[i - 1] ?? p1;
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    parts.push(
      `C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`,
    );
  }
  return parts.join(' ');
}

const MONTH_LABELS_ES = [
  'ENE',
  'FEB',
  'MAR',
  'ABR',
  'MAY',
  'JUN',
  'JUL',
  'AGO',
  'SEP',
  'OCT',
  'NOV',
  'DIC',
];

// why: los meses se etiquetan en la posición X del PRIMER día de ese mes
// dentro del rango cargado. Si el rango cubre desde el 15/03 hasta hoy,
// marzo se pinta al principio (posición del 15) — no en un punto ideal.
function computeMonthTicks(asc: readonly DayAggregate[], columnWidth: number): PanoramaMonthTick[] {
  const seen = new Set<string>();
  const ticks: PanoramaMonthTick[] = [];
  asc.forEach((day, i) => {
    const d = new Date(day.dayStart);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (seen.has(key)) return;
    seen.add(key);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    ticks.push({
      x: i * columnWidth + columnWidth / 2,
      label: MONTH_LABELS_ES[d.getMonth()]!,
      monthStart,
    });
  });
  return ticks;
}

function bandPath(top: readonly Pt[], floor: readonly Pt[]): string {
  if (top.length === 0 || floor.length === 0) return '';
  if (top.length !== floor.length) return '';
  const first = top[0]!;
  const lastFloor = floor[floor.length - 1]!;
  const reversedFloor = [...floor].reverse();
  const parts: string[] = [`M${first.x.toFixed(2)},${first.y.toFixed(2)}`];
  const topCurve = smoothCurve(top);
  if (topCurve) parts.push(topCurve);
  parts.push(`L${lastFloor.x.toFixed(2)},${lastFloor.y.toFixed(2)}`);
  const floorCurve = smoothCurve(reversedFloor);
  if (floorCurve) parts.push(floorCurve);
  parts.push('Z');
  return parts.join(' ');
}

export function computePanoramaGeometry(
  aggregates: readonly DayAggregate[],
  opts: PanoramaOptions = {},
): PanoramaGeometry {
  const cw = opts.columnWidth ?? PANORAMA_COLUMN_WIDTH;
  const H = opts.height ?? PANORAMA_HEIGHT;
  const minH = opts.minColHeight ?? PANORAMA_MIN_H;
  const K = opts.logK ?? PANORAMA_LOG_K;
  const horizonPad = opts.horizonPad ?? PANORAMA_HORIZON_PAD;
  const horizonY = H - horizonPad;
  const asc = [...aggregates].sort((a, b) => a.dayStart - b.dayStart);
  const columns: PanoramaColumn[] = [];
  const mainTopPts: Pt[] = [];
  const commentsTopPts: Pt[] = [];
  const draftTopPts: Pt[] = [];
  const floorPts: Pt[] = [];
  asc.forEach((day, i) => {
    const x = i * cw + cw / 2;
    const raw = Math.log2(1 + day.count) * K;
    const totalH = Math.max(minH, Math.min(H, Math.round(raw)));
    const total = day.count || 1;
    const mainH = Math.round((day.byFacet.main / total) * totalH);
    const commentsH = Math.round((day.byFacet.comments / total) * totalH);
    const draftH = Math.max(0, totalH - mainH - commentsH);
    const mainY = horizonY - mainH;
    const commentsY = mainY - commentsH;
    const draftY = commentsY - draftH;
    mainTopPts.push({ x, y: mainY });
    commentsTopPts.push({ x, y: commentsY });
    draftTopPts.push({ x, y: draftY });
    floorPts.push({ x, y: horizonY });
    columns.push({
      x,
      hitX: i * cw,
      hitWidth: cw,
      dayStart: day.dayStart,
      count: day.count,
      totalHeight: totalH,
      peakY: draftY,
    });
  });
  const width = Math.max(0, cw * asc.length);
  const monthTicks = computeMonthTicks(asc, cw);
  const maxCount = asc.reduce((m, d) => (d.count > m ? d.count : m), 0);
  const yForCount = (n: number): number => {
    const h = Math.max(minH, Math.min(H, Math.round(Math.log2(1 + n) * K)));
    return horizonY - h;
  };
  const yTicks: PanoramaYTick[] = [];
  if (maxCount > 0) {
    const roundNice = (n: number): number => {
      if (n <= 1) return 1;
      if (n <= 5) return Math.round(n);
      if (n <= 20) return Math.round(n / 5) * 5;
      if (n <= 100) return Math.round(n / 10) * 10;
      return Math.round(n / 25) * 25;
    };
    const candidates = [
      Math.max(1, Math.round(maxCount / 4)),
      Math.max(1, Math.round(maxCount / 2)),
      maxCount,
    ]
      .map(roundNice)
      .filter((v, i, arr) => arr.indexOf(v) === i && v > 0);
    for (const c of candidates) yTicks.push({ count: c, y: yForCount(c) });
  }
  return {
    width,
    height: H,
    horizonY,
    viewBox: `0 0 ${width || 1} ${H}`,
    columns,
    monthTicks,
    maxCount,
    yTicks,
    paths: {
      main: bandPath(mainTopPts, floorPts),
      comments: bandPath(commentsTopPts, mainTopPts),
      draft: bandPath(draftTopPts, commentsTopPts),
    },
  };
}

// why: banderines de fósiles se clavan sobre el pico apilado del día — arriba
// del perfil, nunca dentro. Milestones cuyo commit cae fuera del rango cargado
// se descartan silenciosamente (§ regla "UI must not lie").
export interface PanoramaFossil {
  readonly x: number;
  readonly y: number;
  readonly name: string;
  readonly oid: string;
  readonly dayStart: number;
}

// why: el fósil ya no cuelga de un palo — se apoya en la cumbre. Un
// pequeño offset lo levanta lo justo para no quedar dentro de la roca.
const FOSSIL_PEAK_OFFSET = 6;

export function panoramaFossils(
  geo: PanoramaGeometry,
  fossils: readonly { readonly oid: string; readonly name: string; readonly dayStart: number }[],
): readonly PanoramaFossil[] {
  const byDay = new Map<number, PanoramaColumn>();
  for (const c of geo.columns) byDay.set(c.dayStart, c);
  const out: PanoramaFossil[] = [];
  for (const f of fossils) {
    const col = byDay.get(f.dayStart);
    if (!col) continue;
    out.push({
      x: col.x,
      y: Math.max(2, col.peakY - FOSSIL_PEAK_OFFSET),
      name: f.name,
      oid: f.oid,
      dayStart: f.dayStart,
    });
  }
  return out;
}

export function startOfDayMs(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Layered stratum (v2 sesión 2026-07-03): cada estrato se dibuja como una
// banda con tres franjas horizontales apiladas — main abajo, comentarios
// medio, borrador arriba — con altura proporcional al `facetMix` real.
// Los fósiles quedan incrustados en la Y de su faceta y en la X de su
// posición cronológica dentro del bucket. Se lee como roca sedimentaria,
// no como bar chart.
//
// Convención X: `commits` se recorre en el orden en que el bucket los
// entrega (git log → newest first). Para que la lectura vaya
// izquierda=viejo → derecha=nuevo, invertimos: el primero de la lista
// cae al extremo derecho.

export interface StratumLayerRect {
  readonly facet: Facet;
  readonly yPct: number;
  readonly heightPct: number;
}

export interface StratumFossilAnchor {
  readonly oid: string;
  readonly name: string;
  readonly facet: Facet;
  readonly xPct: number;
  readonly yPct: number;
}

export interface StratumLayers {
  readonly totalCount: number;
  readonly layers: readonly StratumLayerRect[];
  readonly fossils: readonly StratumFossilAnchor[];
}

const LAYER_ORDER_TOP_DOWN: readonly Facet[] = ['draft', 'comments', 'main'];

function flattenBucketCommits(bucket: CommitBucket): CommitEntry[] {
  const out: CommitEntry[] = [];
  for (const item of bucket.items) {
    if (item.kind === 'commit') out.push(item.entry);
    else for (const m of item.members) out.push(m);
  }
  return out;
}

export function computeStratumLayers(
  bucket: CommitBucket,
  milestonesByOid: ReadonlyMap<string, readonly MilestoneEntry[]>,
): StratumLayers {
  const commits = flattenBucketCommits(bucket);
  const total = commits.length;
  const mix: Record<Facet, number> = { main: 0, comments: 0, draft: 0 };
  for (const c of commits) mix[facetOf(c.message)]++;
  if (total === 0) {
    return { totalCount: 0, layers: [], fossils: [] };
  }
  const draftPct = (mix.draft / total) * 100;
  const commentsPct = (mix.comments / total) * 100;
  const mainPct = Math.max(0, 100 - draftPct - commentsPct);
  const layers: StratumLayerRect[] = [];
  let y = 0;
  const heightByFacet: Record<Facet, { y: number; h: number }> = {
    draft: { y: 0, h: 0 },
    comments: { y: 0, h: 0 },
    main: { y: 0, h: 0 },
  };
  for (const facet of LAYER_ORDER_TOP_DOWN) {
    const h = facet === 'draft' ? draftPct : facet === 'comments' ? commentsPct : mainPct;
    if (h > 0) {
      layers.push({ facet, yPct: y, heightPct: h });
      heightByFacet[facet] = { y, h };
    }
    y += h;
  }
  const fossils: StratumFossilAnchor[] = [];
  commits.forEach((c, i) => {
    const ms = milestonesByOid.get(c.oid);
    if (!ms) return;
    const facet = facetOf(c.message);
    // Invert order: newest (idx 0) → right; oldest (idx total-1) → left.
    // Pad edges 4% so fossils on the very first/last commit don't fall on the border.
    const xPct = total === 1 ? 50 : 4 + ((total - 1 - i) / (total - 1)) * 92;
    const band = heightByFacet[facet];
    const yPct = band.h > 0 ? band.y + band.h / 2 : 50;
    for (const m of ms) {
      fossils.push({ oid: c.oid, name: m.name, facet, xPct, yPct });
    }
  });
  return { totalCount: total, layers, fossils };
}
