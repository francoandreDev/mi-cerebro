// Global branch-topology view for /variants. One lane per family.
// Hover/focus → dims the non-hovered lanes inside the graph (purely
// visual, no external side-effect). Click on a lane → scrolls the
// corresponding card into view and opens a popover with the same
// actions the card exposes. Click on a HEAD or milestone → deep-links
// to /history at that commit.
//
// Geometry is qualitative — x positions are evenly spaced fork columns,
// not commit timestamps. The graph answers "who came from whom and
// where are they now?", not "when did each commit happen?". For
// chronological detail the user opens /history.

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import { PRINCIPAL_VARIANT_ID, type Variant } from '@core/versioning/variants.types';

import type { VariantOverview } from '../services/variants-stats.service';

interface LaneNode {
  readonly v: Variant;
  readonly y: number;
  readonly forkX: number;
  readonly headX: number;
  readonly parentY: number | null;
  readonly headOidShort: string;
  readonly forkOidShort: string;
  readonly milestone: { name: string; oid: string } | null;
  readonly head: { oid: string } | null;
  readonly dashed: boolean;
}

interface GraphModel {
  readonly width: number;
  readonly height: number;
  readonly lanes: readonly LaneNode[];
}

export type LaneActionKind = 'switch' | 'rename' | 'merge' | 'delete';

export interface LaneActionRequest {
  readonly id: string;
  readonly kind: LaneActionKind;
}

interface MenuState {
  readonly variantId: string;
  readonly x: number;
  readonly y: number;
}

const VIEW_WIDTH = 960;
const LANE_HEIGHT = 56;
const TOP_PAD = 32;
const BOTTOM_PAD = 24;
const LEFT_PAD = 32;
const RIGHT_PAD = 200;
const FORK_COL_START = 220;
const FORK_COL_STEP = 64;

@Component({
  selector: 'mc-variants-overview-graph',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './variants-overview-graph.component.html',
  styleUrl: './variants-overview-graph.component.css',
})
export class VariantsOverviewGraphComponent {
  private readonly i18n = inject(I18nService);

  readonly variants = input.required<readonly Variant[]>();
  readonly overviews = input.required<Record<string, VariantOverview>>();
  readonly activeId = input<string | null>(null);

  readonly selectVariant = output<string>();
  readonly requestAction = output<LaneActionRequest>();
  readonly openCommit = output<string>();

  protected readonly model = computed<GraphModel>(() => this.build());

  protected readonly hoveredId = signal<string | null>(null);
  protected readonly menu = signal<MenuState | null>(null);

  protected readonly ariaLabel = computed(() =>
    this.i18n.t('variants.graph.overview.aria', { n: this.variants().length }),
  );

  protected readonly menuVariant = computed<Variant | null>(() => {
    const id = this.menu()?.variantId;
    if (!id) return null;
    return this.variants().find((v) => v.id === id) ?? null;
  });

  protected t(
    key: Parameters<I18nService['t']>[0],
    params?: Record<string, string | number>,
  ): string {
    return this.i18n.t(key, params);
  }

  protected isActive(v: Variant): boolean {
    return v.id === this.activeId();
  }

  protected onLaneEnter(id: string): void {
    this.hoveredId.set(id);
  }

  protected onLaneLeave(): void {
    this.hoveredId.set(null);
  }

  protected onLaneClick(lane: LaneNode, ev: MouseEvent): void {
    ev.stopPropagation();
    const target = ev.currentTarget as Element;
    const host = target.closest('mc-variants-overview-graph') ?? target;
    const rect = host.getBoundingClientRect();
    this.menu.set({
      variantId: lane.v.id,
      x: ev.clientX - rect.left,
      y: ev.clientY - rect.top,
    });
    this.selectVariant.emit(lane.v.id);
  }

  protected onLaneKey(lane: LaneNode, ev: KeyboardEvent): void {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    ev.preventDefault();
    // why: keyboard activation can't carry a click position, so anchor
    //      the menu to the head of the lane in viewport coords.
    const target = ev.currentTarget as Element;
    const host = target.closest('mc-variants-overview-graph') ?? target;
    const rect = host.getBoundingClientRect();
    const scaleX = rect.width / VIEW_WIDTH;
    this.menu.set({
      variantId: lane.v.id,
      x: lane.headX * scaleX - 80,
      y: lane.y * scaleX + 24,
    });
    this.selectVariant.emit(lane.v.id);
  }

  protected closeMenu(): void {
    this.menu.set(null);
  }

  protected pickAction(kind: LaneActionKind): void {
    const id = this.menu()?.variantId;
    this.menu.set(null);
    if (id) this.requestAction.emit({ id, kind });
  }

  protected onHeadClick(lane: LaneNode, ev: MouseEvent): void {
    if (!lane.head) return;
    ev.stopPropagation();
    this.openCommit.emit(lane.head.oid);
  }

  protected onHeadKey(lane: LaneNode, ev: KeyboardEvent): void {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    if (!lane.head) return;
    ev.preventDefault();
    this.openCommit.emit(lane.head.oid);
  }

  protected onMilestoneClick(lane: LaneNode, ev: MouseEvent): void {
    if (!lane.milestone) return;
    ev.stopPropagation();
    this.openCommit.emit(lane.milestone.oid);
  }

  protected onMilestoneKey(lane: LaneNode, ev: KeyboardEvent): void {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    if (!lane.milestone) return;
    ev.preventDefault();
    this.openCommit.emit(lane.milestone.oid);
  }

  protected isMenuOpen(id: string): boolean {
    return this.menu()?.variantId === id;
  }

  protected isLaneHovered(id: string): boolean {
    return this.hoveredId() === id;
  }

  protected isLaneDimmed(id: string): boolean {
    const hovered = this.hoveredId();
    return hovered !== null && hovered !== id;
  }

  protected laneAria(v: Variant): string {
    return this.i18n.t('variants.graph.lane.aria', { name: v.name });
  }

  protected forkPath(lane: LaneNode): string {
    if (lane.parentY === null) return '';
    const cx = lane.forkX + 24;
    return `M ${lane.forkX} ${lane.parentY} C ${cx} ${lane.parentY}, ${cx} ${lane.y}, ${lane.forkX + 32} ${lane.y}`;
  }

  protected viewBox(): string {
    const m = this.model();
    return `0 0 ${m.width} ${m.height}`;
  }

  private build(): GraphModel {
    const order = topoOrder(this.variants());
    const yByVariantId = new Map<string, number>();
    order.forEach((v, i) => yByVariantId.set(v.id, TOP_PAD + i * LANE_HEIGHT));

    const headX = VIEW_WIDTH - RIGHT_PAD;
    const nonPrincipal = order.filter((v) => v.id !== PRINCIPAL_VARIANT_ID);
    const forkXByVariantId = new Map<string, number>();
    nonPrincipal.forEach((v, i) => forkXByVariantId.set(v.id, FORK_COL_START + i * FORK_COL_STEP));

    const lanes: LaneNode[] = order.map((v) => {
      const ov = this.overviews()[v.id] ?? null;
      const y = yByVariantId.get(v.id) ?? TOP_PAD;
      const parentY =
        v.parentId && yByVariantId.has(v.parentId) ? (yByVariantId.get(v.parentId) ?? null) : null;
      const forkX =
        v.id === PRINCIPAL_VARIANT_ID ? LEFT_PAD : (forkXByVariantId.get(v.id) ?? LEFT_PAD);
      return {
        v,
        y,
        forkX,
        headX,
        parentY,
        headOidShort: ov?.head ? ov.head.oid.slice(0, 7) : '',
        forkOidShort: v.forkOid ? v.forkOid.slice(0, 7) : '',
        milestone: ov?.milestone ? { name: ov.milestone.name, oid: ov.milestone.oid } : null,
        head: ov?.head ? { oid: ov.head.oid } : null,
        dashed: ov ? ov.ahead > 0 : false,
      };
    });

    const height = TOP_PAD + order.length * LANE_HEIGHT + BOTTOM_PAD;
    return { width: VIEW_WIDTH, height, lanes };
  }
}

function topoOrder(variants: readonly Variant[]): Variant[] {
  const byId = new Map(variants.map((v) => [v.id, v] as const));
  const children = new Map<string | null, Variant[]>();
  for (const v of variants) {
    const key = v.id === PRINCIPAL_VARIANT_ID ? null : (v.parentId ?? PRINCIPAL_VARIANT_ID);
    const list = children.get(key) ?? [];
    list.push(v);
    children.set(key, list);
  }
  const out: Variant[] = [];
  const seen = new Set<string>();
  const principal = byId.get(PRINCIPAL_VARIANT_ID);
  if (principal) {
    out.push(principal);
    seen.add(principal.id);
    walk(principal.id);
  }
  for (const v of variants) {
    if (!seen.has(v.id)) {
      out.push(v);
      seen.add(v.id);
      walk(v.id);
    }
  }
  return out;

  function walk(parentId: string): void {
    const kids = children.get(parentId);
    if (!kids) return;
    for (const k of kids) {
      if (seen.has(k.id)) continue;
      out.push(k);
      seen.add(k.id);
      walk(k.id);
    }
  }
}
