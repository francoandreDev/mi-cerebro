import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import { IconComponent } from '@shared/icon/icon.component';

import { facetOf, type Facet } from '../services/facet';
import type { DayAggregate } from '../services/history-loader.service';
import type { CommitEntry } from '../services/history.types';
import { readSS, writeSS } from '../services/session-store';
import { computePanoramaGeometry, panoramaFossils, startOfDayMs } from '../services/strata.utils';
import type { PanoramaColumn, PanoramaGeometry, PanoramaFossil } from '../services/strata.utils';

const SS_PAN_DAY = 'mc:history:panoramaDay';

export interface FlatFossil {
  readonly oid: string;
  readonly name: string;
  readonly dayStart: number;
}

@Component({
  selector: 'mc-history-panorama',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './history-panorama.component.html',
  styleUrls: ['./history-panorama.component.css', './history-panorama.component.mobile.css'],
})
export class HistoryPanoramaComponent {
  protected readonly i18n = inject(I18nService);

  readonly entries = input.required<readonly CommitEntry[]>();
  readonly aggregates = input.required<readonly DayAggregate[]>();
  readonly loading = input.required<boolean>();
  readonly error = input.required<string | null>();
  readonly noResults = input.required<boolean>();
  readonly headOid = input.required<string | null>();
  readonly flatFossils = input.required<readonly FlatFossil[]>();
  readonly allFacets = input.required<readonly Facet[]>();
  readonly query = input.required<string>();
  readonly enabledFacets = input.required<ReadonlySet<Facet>>();
  readonly onlyMilestones = input.required<boolean>();

  readonly selectDay = output<number>();
  readonly activateDay = output<number>();
  readonly jumpToFossil = output<{ oid: string; name: string }>();
  readonly queryChange = output<string>();
  readonly clearQuery = output<void>();
  readonly toggleFacet = output<Facet>();
  readonly toggleOnlyMilestones = output<void>();

  protected isFacetEnabled(f: Facet): boolean {
    return this.enabledFacets().has(f);
  }

  protected onQueryInput(ev: Event): void {
    this.queryChange.emit((ev.target as HTMLInputElement).value);
  }

  // why: el plan pide techo dinámico ~40% del viewport para que la silueta
  // respire y se lea como paisaje. Se lee una sola vez al construirse
  // (mismo comportamiento que tenía en el container — no hay listener de
  // resize hoy).
  private readonly viewportH =
    typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.4) : 260;

  protected readonly hoverColumn = signal<PanoramaColumn | null>(null);

  private readonly aggByDay = computed<ReadonlyMap<number, DayAggregate>>(
    () => new Map(this.aggregates().map((a) => [a.dayStart, a])),
  );

  protected readonly geometry = computed<PanoramaGeometry>(() => {
    const H = Math.max(160, this.viewportH);
    return computePanoramaGeometry(this.aggregates(), { height: H });
  });
  protected readonly fossils = computed<readonly PanoramaFossil[]>(() =>
    panoramaFossils(this.geometry(), this.flatFossils()),
  );

  protected readonly headColumn = computed(() => {
    const head = this.headOid();
    if (!head) return null;
    const entry = this.entries().find((e) => e.oid === head);
    if (!entry) return null;
    const day = startOfDayMs(entry.date.getTime());
    return this.geometry().columns.find((c) => c.dayStart === day) ?? null;
  });

  private readonly selectedDayStartSignal = signal<number | null>(readInitialSelectedDay());
  protected readonly selectedDayStart = this.selectedDayStartSignal.asReadonly();
  protected readonly selectedColumn = computed(() => {
    const sel = this.selectedDayStartSignal();
    if (sel === null) return null;
    return this.geometry().columns.find((c) => c.dayStart === sel) ?? null;
  });

  protected readonly explorerColumn = computed(() => this.selectedColumn() ?? this.headColumn());

  // why: la posición renderizada del excursionista sale de una animación
  // RAF que muestrea las columnas intermedias entre origen y destino, en
  // vez de interpolar linealmente — camina siguiendo la silueta real.
  protected readonly explorerPos = signal<{
    xPct: number;
    yPct: number;
    walking: boolean;
  } | null>(null);
  private explorerRafId: number | null = null;

  protected readonly rangeSummary = computed(() => {
    const day = this.selectedDayStartSignal();
    if (day === null) return null;
    const entriesOfDay = this.entries().filter((e) => startOfDayMs(e.date.getTime()) === day);
    const facetMix: Record<Facet, number> = { main: 0, comments: 0, draft: 0 };
    for (const e of entriesOfDay) facetMix[facetOf(e.message)]++;
    const fossils = this.flatFossils()
      .filter((f) => f.dayStart === day)
      .map((f) => ({ oid: f.oid, name: f.name }));
    return {
      day,
      dayLabel: new Date(day).toLocaleDateString('es-AR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
      total: entriesOfDay.length,
      facetMix,
      fossils,
      entries: entriesOfDay,
    };
  });

  constructor() {
    effect(() =>
      writeSS(
        SS_PAN_DAY,
        this.selectedDayStartSignal() === null ? null : String(this.selectedDayStartSignal()),
      ),
    );

    // why: mueve al excursionista siguiendo la silueta cuando cambia la
    //      columna destino, con easing cubic-in-out en vez de cortar recto.
    effect(() => {
      const target = this.explorerColumn();
      const geo = this.geometry();
      if (!target || geo.columns.length === 0) {
        this.cancelExplorerAnimation();
        return;
      }
      const targetIdx = geo.columns.indexOf(target);
      if (targetIdx < 0) return;
      const current = this.explorerPos();
      if (!current) {
        this.explorerPos.set({
          xPct: (target.x / (geo.width || 1)) * 100,
          yPct: (target.peakY / geo.height) * 100,
          walking: false,
        });
        return;
      }
      this.animateExplorerAlongRidge(targetIdx, geo);
    });
  }

  private cancelExplorerAnimation(): void {
    if (this.explorerRafId !== null) {
      cancelAnimationFrame(this.explorerRafId);
      this.explorerRafId = null;
    }
  }

  private animateExplorerAlongRidge(targetIdx: number, geo: PanoramaGeometry): void {
    this.cancelExplorerAnimation();
    const cols = geo.columns;
    const current = this.explorerPos();
    if (!current) return;
    const currentX = (current.xPct / 100) * (geo.width || 1);
    let startIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < cols.length; i++) {
      const dx = Math.abs(cols[i]!.x - currentX);
      if (dx < minDist) {
        minDist = dx;
        startIdx = i;
      }
    }
    if (startIdx === targetIdx) {
      const c = cols[targetIdx]!;
      this.explorerPos.set({
        xPct: (c.x / (geo.width || 1)) * 100,
        yPct: (c.peakY / geo.height) * 100,
        walking: false,
      });
      return;
    }
    const distance = Math.abs(targetIdx - startIdx);
    const durationMs = Math.min(3200, 500 + distance * 110);
    const t0 = performance.now();
    const easeInOutCubic = (t: number): number =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const step = (now: number): void => {
      const raw = Math.min(1, (now - t0) / durationMs);
      const eased = easeInOutCubic(raw);
      const idxFloat = startIdx + (targetIdx - startIdx) * eased;
      const idxA = Math.max(0, Math.min(cols.length - 1, Math.floor(idxFloat)));
      const idxB = Math.max(0, Math.min(cols.length - 1, Math.ceil(idxFloat)));
      const frac = idxFloat - Math.floor(idxFloat);
      const a = cols[idxA]!;
      const b = cols[idxB]!;
      const x = a.x + (b.x - a.x) * frac;
      const y = a.peakY + (b.peakY - a.peakY) * frac;
      this.explorerPos.set({
        xPct: (x / (geo.width || 1)) * 100,
        yPct: (y / geo.height) * 100,
        walking: raw < 1,
      });
      if (raw < 1) {
        this.explorerRafId = requestAnimationFrame(step);
      } else {
        this.explorerRafId = null;
      }
    };
    this.explorerRafId = requestAnimationFrame(step);
  }

  protected setSelectedDay(dayStart: number): void {
    this.selectedDayStartSignal.set(dayStart);
    this.selectDay.emit(dayStart);
  }

  protected onColumnActivate(dayStart: number): void {
    this.activateDay.emit(dayStart);
  }

  protected onFossilClick(oid: string, name: string): void {
    this.jumpToFossil.emit({ oid, name });
  }

  protected onZoomIntoRange(): void {
    const day = this.selectedDayStartSignal();
    if (day !== null) this.activateDay.emit(day);
  }

  protected facetLabelKey(f: Facet): `versioning.history.facet.${Facet}` {
    return `versioning.history.facet.${f}`;
  }

  protected facetPct(mix: Record<Facet, number>, f: Facet): number {
    const total = Math.max(1, mix.main + mix.comments + mix.draft);
    return Math.round((mix[f] / total) * 100);
  }

  protected columnTitle(dayStart: number, count: number): string {
    return this.i18n.t('versioning.history.panorama.columnTitle', {
      date: new Date(dayStart).toLocaleDateString(),
      n: count,
    });
  }

  protected tooltipFacets(dayStart: number): readonly string[] {
    const agg = this.aggByDay().get(dayStart);
    if (!agg || agg.count === 0) return [];
    return (['main', 'comments', 'draft'] as const)
      .filter((f) => agg.byFacet[f] > 0)
      .map((f) =>
        this.i18n.t('versioning.history.panorama.facetShare', {
          facet: this.i18n.t(`versioning.history.facet.${f}` as const),
          n: agg.byFacet[f],
          pct: Math.round((agg.byFacet[f] / agg.count) * 100),
        }),
      );
  }
}

function readInitialSelectedDay(): number | null {
  const raw = readSS(SS_PAN_DAY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
