// Pure geometry for the delta view of /variants. Turns a flat list of
// Variants into channels (SVG paths) laid out as a river system:
// Principal is the top channel; every other variant is a tributary that
// forks off its parent's channel and settles into its own horizontal
// lane. Orphans (parentId points nowhere) get a root-level lane and
// draw as straight lines with no fork marker — semantically "origen
// desconocido", not a lie.

import { PRINCIPAL_VARIANT_ID, type Variant } from '@core/versioning/variants.types';

export interface DeltaArm {
  readonly variant: Variant;
  readonly lane: number;
  readonly y: number;
  readonly startX: number;
  readonly channelPath: string;
  readonly labelX: number;
  readonly tailX: number;
  readonly forkX: number | null;
  readonly forkY: number | null;
}

export interface DeltaLayout {
  readonly arms: readonly DeltaArm[];
  readonly width: number;
  readonly height: number;
}

const LANE_HEIGHT = 72;
const TOP_PADDING = 56;
const BOTTOM_PADDING = 40;
const LEFT_PADDING = 32;
const RIGHT_TAIL = 220;
const FORK_STEP = 140;
const HORIZONTAL_OFFSET = 56;
const CURVE = 42;
const MIN_WIDTH = 640;

export function buildDeltaLayout(variants: readonly Variant[]): DeltaLayout {
  const byId = new Map(variants.map((v) => [v.id, v] as const));
  const childrenByParent = new Map<string, Variant[]>();
  const roots: Variant[] = [];

  for (const v of variants) {
    if (v.id === PRINCIPAL_VARIANT_ID) continue;
    if (v.parentId && byId.has(v.parentId)) {
      const arr = childrenByParent.get(v.parentId) ?? [];
      arr.push(v);
      childrenByParent.set(v.parentId, arr);
    } else {
      roots.push(v);
    }
  }

  const byActivityDesc = (a: Variant, b: Variant): number => b.lastActivityAt - a.lastActivityAt;
  for (const arr of childrenByParent.values()) arr.sort(byActivityDesc);
  roots.sort(byActivityDesc);

  interface Plan {
    readonly variant: Variant;
    readonly lane: number;
    readonly startX: number;
    readonly forkX: number | null;
    readonly forkY: number | null;
  }
  const plans: Plan[] = [];
  let nextLane = 0;

  const walk = (variant: Variant, parentStartX: number, parentY: number | null): void => {
    const lane = nextLane++;
    const y = TOP_PADDING + lane * LANE_HEIGHT;
    let startX: number;
    let forkX: number | null = null;
    let forkY: number | null = null;
    if (parentY === null) {
      startX = LEFT_PADDING;
    } else {
      const siblings = childrenByParent.get(variant.parentId ?? '') ?? [];
      const idx = siblings.findIndex((s) => s.id === variant.id);
      forkX = parentStartX + (idx + 1) * FORK_STEP;
      forkY = parentY;
      startX = forkX + HORIZONTAL_OFFSET;
    }
    plans.push({ variant, lane, startX, forkX, forkY });

    const kids = childrenByParent.get(variant.id) ?? [];
    for (const k of kids) walk(k, startX, y);
  };

  const principal = byId.get(PRINCIPAL_VARIANT_ID);
  if (principal) walk(principal, LEFT_PADDING, null);
  for (const r of roots) walk(r, LEFT_PADDING, null);

  const maxStartX = plans.reduce((m, p) => Math.max(m, p.startX), LEFT_PADDING);
  const width = Math.max(MIN_WIDTH, maxStartX + RIGHT_TAIL);
  const laneCount = Math.max(1, nextLane);
  const height = TOP_PADDING + laneCount * LANE_HEIGHT + BOTTOM_PADDING;
  const tailX = width - LEFT_PADDING;

  const arms: DeltaArm[] = plans.map((p) => {
    const y = TOP_PADDING + p.lane * LANE_HEIGHT;
    const channelPath =
      p.forkX === null || p.forkY === null
        ? `M ${p.startX} ${y} L ${tailX} ${y}`
        : `M ${p.forkX} ${p.forkY} C ${p.forkX + CURVE} ${p.forkY}, ${p.startX - CURVE} ${y}, ${p.startX} ${y} L ${tailX} ${y}`;
    return {
      variant: p.variant,
      lane: p.lane,
      y,
      startX: p.startX,
      channelPath,
      labelX: p.startX + 20,
      tailX,
      forkX: p.forkX,
      forkY: p.forkY,
    };
  });

  return { arms, width, height };
}
