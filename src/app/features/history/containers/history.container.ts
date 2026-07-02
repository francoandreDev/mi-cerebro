import type { OnDestroy, OnInit } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ErrorService } from '@core/errors/error.service';
import { I18nService } from '@core/i18n/i18n.service';
import { CompactionSchedulerService } from '@core/versioning/compaction-scheduler.service';
import { RestoreService } from '@core/versioning/restore.service';
import { IconComponent } from '@shared/icon/icon.component';
import { McDatePipe } from '@shared/pipes/mc-date.pipe';

import type { TranslationKey } from '@core/i18n/i18n.types';

import { ShortcutsService } from '@core/shortcuts/shortcuts.service';

import { BUCKET_LABEL_KEY } from '../services/bucket-labels';
import { HistoryDiffService } from '../services/diff.service';
import type { EntityDiff } from '../services/diff.service';
import type { AnchorChangeStatus, AnchorMode } from '../services/diff.utils';
import { ALL_FACETS, facetOf, type Facet } from '../services/facet';
import { HistoryLoader } from '../services/history-loader.service';
import type { DayAggregate } from '../services/history-loader.service';
import { HistoryService } from '../services/history.service';
import type {
  BucketId,
  CommitBucket,
  CommitEntry,
  MilestoneEntry,
  TimelineItem,
} from '../services/history.types';
import { MilestoneController } from '../services/milestone.controller';
import {
  EMPTY_DENSITY,
  computeDensity,
  computePanoramaGeometry,
  computeStratumLayers,
  panoramaFossils,
  startOfDayMs,
} from '../services/strata.utils';
import type {
  PanoramaGeometry,
  PanoramaFossil,
  StratumDensity,
  StratumLayers,
} from '../services/strata.utils';

type GroupKey = 'notes' | 'tasks' | 'books' | 'drafts' | 'comments' | 'meta' | 'other';

export type HistoryZoom = 'panorama' | 'strata' | 'detail';
const ZOOM_ORDER: readonly HistoryZoom[] = ['panorama', 'strata', 'detail'];

export interface Stratum {
  readonly id: BucketId;
  readonly items: readonly TimelineItem[];
  readonly density: StratumDensity;
  readonly layers: StratumLayers;
}

type EntityFeedRow =
  | { readonly kind: 'header'; readonly key: GroupKey; readonly id: string; readonly count: number }
  | { readonly kind: 'entity'; readonly diff: EntityDiff; readonly id: string };

const GROUP_ORDER: readonly GroupKey[] = [
  'notes',
  'tasks',
  'books',
  'drafts',
  'comments',
  'meta',
  'other',
];

interface ParsedQuery {
  readonly facet: Facet | null;
  readonly sinceMs: number | null;
  readonly sha: string | null;
  readonly text: readonly string[];
}

function parseSearchQuery(raw: string): ParsedQuery {
  const trimmed = raw.trim();
  if (!trimmed) return { facet: null, sinceMs: null, sha: null, text: [] };
  let facet: Facet | null = null;
  let sinceMs: number | null = null;
  let sha: string | null = null;
  const text: string[] = [];
  for (const tok of trimmed.split(/\s+/)) {
    const lc = tok.toLowerCase();
    const facetMatch = /^facet:(main|comments|draft)$/.exec(lc);
    if (facetMatch) {
      facet = facetMatch[1] as Facet;
      continue;
    }
    const sinceMatch = /^since:(\d+)([dhw])$/.exec(lc);
    if (sinceMatch) {
      const n = Number(sinceMatch[1]);
      const unit = sinceMatch[2];
      const ms = unit === 'h' ? n * 3_600_000 : unit === 'w' ? n * 604_800_000 : n * 86_400_000;
      sinceMs = Date.now() - ms;
      continue;
    }
    const shaMatch = /^(?:sha:)?([0-9a-f]{4,40})$/i.exec(tok);
    if (shaMatch) {
      sha = shaMatch[1]!.toLowerCase();
      continue;
    }
    text.push(lc);
  }
  return { facet, sinceMs, sha, text };
}

function matchesQuery(entry: CommitEntry, q: ParsedQuery): boolean {
  if (q.facet && facetOf(entry.message) !== q.facet) return false;
  if (q.sinceMs !== null && entry.date.getTime() < q.sinceMs) return false;
  if (q.sha && !entry.oid.toLowerCase().startsWith(q.sha)) return false;
  if (q.text.length > 0) {
    const haystack = entry.message.toLowerCase();
    for (const term of q.text) {
      if (!haystack.includes(term)) return false;
    }
  }
  return true;
}

function groupKeyForPath(path: string): GroupKey {
  if (path.startsWith('notes/')) return 'notes';
  if (path.startsWith('tasks/')) return 'tasks';
  if (path.startsWith('books/')) return 'books';
  if (path.startsWith('drafts/')) return 'drafts';
  if (path.startsWith('comments/')) return 'comments';
  if (path.startsWith('.mi-cerebro/')) return 'meta';
  return 'other';
}

@Component({
  selector: 'mc-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [HistoryLoader, HistoryService, HistoryDiffService, MilestoneController],
  imports: [McDatePipe, IconComponent, NgTemplateOutlet, RouterLink],
  templateUrl: './history.container.html',
  styleUrl: './history.container.css',
})
export class HistoryContainer implements OnInit, OnDestroy {
  private readonly history = inject(HistoryService);
  private readonly loader = inject(HistoryLoader);
  private readonly hostRef: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly diff = inject(HistoryDiffService);
  private readonly restore = inject(RestoreService);
  private readonly compactionScheduler = inject(CompactionSchedulerService);
  private readonly shortcuts = inject(ShortcutsService);
  protected readonly suggestEnableCompaction =
    this.compactionScheduler.shouldSuggestEnableCompaction;
  protected readonly milestones = inject(MilestoneController);
  private readonly errors = inject(ErrorService);
  protected readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);

  protected readonly loading = this.history.loading;
  protected readonly error = this.history.error;
  protected readonly entries = this.history.entries;
  protected readonly headOid = this.history.headOid;
  protected readonly milestonesByOid = this.history.milestonesByOid;
  private readonly originByOid = this.history.originByOid;
  private readonly variantsById = this.history.variantsById;

  // Color del borde-izq de cada commit según la variante en la que fue
  // autoreado. Cuando no podemos atribuirla (raro, refs faltantes), devolvemos
  // null y la regla CSS por faceta queda como fallback visual.
  protected commitOriginColor(oid: string): string | null {
    const id = this.originByOid().get(oid);
    if (!id) return null;
    return this.variantsById().get(id)?.color ?? null;
  }
  protected commitOriginName(oid: string): string | null {
    const id = this.originByOid().get(oid);
    if (!id) return null;
    return this.variantsById().get(id)?.name ?? id;
  }

  private readonly onlyMilestonesSignal = signal(false);
  protected readonly onlyMilestones = this.onlyMilestonesSignal.asReadonly();
  protected toggleOnlyMilestones(): void {
    this.onlyMilestonesSignal.update((v) => !v);
  }

  // Free-text search over the timeline. Tokens:
  //  - facet:main|comments|draft  → faceta filter (also AND'd with chips)
  //  - since:Nd                    → solo commits con date ≥ ahora − N días
  //  - sha o sha:abc1234           → match por shortOid
  //  - cualquier otro token        → substring case-insensitive en el mensaje
  protected readonly query = signal('');
  protected onQueryInput(ev: Event): void {
    this.query.set((ev.target as HTMLInputElement).value);
  }
  protected clearQuery(): void {
    this.query.set('');
  }
  private readonly parsedQuery = computed<ParsedQuery>(() => parseSearchQuery(this.query()));

  // Collapsing either pane gives the other one the full /history width.
  // State is ephemeral on purpose: leaving and re-entering /history
  // resets to "both expanded" so the user never lands on a confusing
  // half-hidden screen.
  private readonly timelineCollapsedSignal = signal(false);
  protected readonly timelineCollapsed = this.timelineCollapsedSignal.asReadonly();
  protected toggleTimeline(): void {
    this.timelineCollapsedSignal.set(!this.timelineCollapsedSignal());
  }

  // Faceta filter: chips at the top of the timeline let the user collapse
  // by branch family (main / comentarios / borrador). Default is all-on.
  // The set is constrained never to be empty so the user can't accidentally
  // hide everything by toggling the last chip off.
  protected readonly allFacets = ALL_FACETS;
  private readonly enabledFacetsSignal = signal<ReadonlySet<Facet>>(new Set(ALL_FACETS));
  protected readonly enabledFacets = this.enabledFacetsSignal.asReadonly();
  protected isFacetEnabled(f: Facet): boolean {
    return this.enabledFacetsSignal().has(f);
  }
  protected facetLabelKey(f: Facet): `versioning.history.facet.${Facet}` {
    return `versioning.history.facet.${f}`;
  }
  protected toggleFacet(f: Facet): void {
    this.enabledFacetsSignal.update((s) => {
      const next = new Set(s);
      if (next.has(f)) {
        if (next.size === 1) return s;
        next.delete(f);
      } else {
        next.add(f);
      }
      return next;
    });
  }

  // Filter the timeline by the "only milestones" toggle and by the
  // enabled facetas (mutually combinable). Buckets with zero matching
  // entries are dropped so the empty-state shows instead of bare headers.
  // Merge groups are kept when any member matches.
  private readonly noiseOidsSignal = signal<ReadonlySet<string>>(new Set());

  protected readonly buckets = computed<readonly CommitBucket[]>(() => {
    const all = this.history.buckets();
    const onlyMile = this.onlyMilestonesSignal();
    const facets = this.enabledFacetsSignal();
    const byOid = this.milestonesByOid();
    const noise = this.noiseOidsSignal();
    const q = this.parsedQuery();
    const matches = (entry: CommitEntry): boolean => {
      // why: milestones nunca se ocultan aunque sean ruido — el usuario
      //      decidió marcarlos como puntos relevantes.
      if (noise.has(entry.oid) && !byOid.has(entry.oid)) return false;
      if (!facets.has(facetOf(entry.message))) return false;
      if (onlyMile && !byOid.has(entry.oid)) return false;
      if (!matchesQuery(entry, q)) return false;
      return true;
    };
    const transformItem = (item: TimelineItem): TimelineItem | null => {
      if (item.kind === 'commit') return matches(item.entry) ? item : null;
      const kept = item.members.filter(matches);
      if (kept.length === 0) return null;
      if (kept.length === item.members.length) return item;
      if (kept.length === 1) return { kind: 'commit', entry: kept[0]! };
      return { ...item, members: kept, latest: kept[0]! };
    };
    return all
      .map((b) => ({
        id: b.id,
        items: b.items.map(transformItem).filter((x): x is TimelineItem => x !== null),
      }))
      .filter((b) => b.items.length > 0);
  });

  // why: density (thickness + facet mix + fossils) comes from the *unfiltered*
  //      bucket so search/chips never shrink the stratum band — geology stays
  //      honest. Filtered items still drive what commits render inside.
  protected readonly strata = computed<readonly Stratum[]>(() => {
    const filtered = this.buckets();
    const unfiltered = this.history.buckets();
    const byOid = this.milestonesByOid();
    const densityById = new Map<BucketId, StratumDensity>();
    const layersById = new Map<BucketId, StratumLayers>();
    for (const b of unfiltered) {
      densityById.set(b.id, computeDensity(b, byOid));
      layersById.set(b.id, computeStratumLayers(b, byOid));
    }
    return filtered.map((b) => ({
      id: b.id,
      items: b.items,
      density: densityById.get(b.id) ?? EMPTY_DENSITY,
      layers: layersById.get(b.id) ?? { totalCount: 0, layers: [], fossils: [] },
    }));
  });

  // Zoom control (§13 Fase 3): panorama (cordillera), strata (corte), detail
  // (cordel). LOD viewers over the mismo objeto — cambia rango/densidad, no
  // representación entre niveles.
  private readonly zoomSignal = signal<HistoryZoom>('panorama');
  protected readonly zoom = this.zoomSignal.asReadonly();
  protected readonly zoomOrder = ZOOM_ORDER;
  // why: los niveles son secuenciales — la única forma de bajar al siguiente
  // es haciendo la acción del anterior (seleccionar día en cordillera para
  // desbloquear estratos; seleccionar veta en estratos para desbloquear
  // cordel). Ir hacia atrás siempre está permitido. Esto convierte los
  // niveles en un flujo real y no en tres vistas paralelas independientes.
  private readonly unlockedLevelSignal = signal<HistoryZoom>('panorama');
  protected readonly unlockedLevel = this.unlockedLevelSignal.asReadonly();
  protected canEnterZoom(z: HistoryZoom): boolean {
    return ZOOM_ORDER.indexOf(z) <= ZOOM_ORDER.indexOf(this.unlockedLevelSignal());
  }
  private unlockUpTo(z: HistoryZoom): void {
    const cur = ZOOM_ORDER.indexOf(this.unlockedLevelSignal());
    const next = ZOOM_ORDER.indexOf(z);
    if (next > cur) this.unlockedLevelSignal.set(z);
  }
  protected setZoom(z: HistoryZoom): void {
    if (!this.canEnterZoom(z)) return;
    this.zoomSignal.set(z);
  }
  // why: la única forma "hacia atrás" en el flujo. Adelantar sólo se hace
  // completando la acción del nivel actual (elegir cumbre / elegir veta).
  protected zoomBack(): void {
    const cur = this.zoomSignal();
    const idx = ZOOM_ORDER.indexOf(cur);
    const prev = ZOOM_ORDER[Math.max(0, idx - 1)];
    if (prev && prev !== cur) this.zoomSignal.set(prev);
  }
  protected zoomBackLabelKey(): TranslationKey | null {
    const cur = this.zoomSignal();
    const idx = ZOOM_ORDER.indexOf(cur);
    if (idx <= 0) return null;
    const prev = ZOOM_ORDER[idx - 1]!;
    return `versioning.history.zoom.backTo.${prev}` as TranslationKey;
  }
  protected searchPlaceholderKey(): TranslationKey {
    const z = this.zoomSignal();
    return `versioning.history.search.placeholder.${z}` as TranslationKey;
  }
  private stepZoom(delta: 1 | -1): void {
    const cur = this.zoomSignal();
    const idx = ZOOM_ORDER.indexOf(cur);
    const next = ZOOM_ORDER[Math.min(ZOOM_ORDER.length - 1, Math.max(0, idx + delta))];
    if (next && next !== cur && this.canEnterZoom(next)) this.zoomSignal.set(next);
  }

  // Panorama data (aggregate por día). Se hidrata off critical path la
  // primera vez que el usuario sube al zoom cordillera; cachea el resultado
  // por sesión hasta que ocurra un reloadAll().
  private readonly panoramaAggregatesSignal = signal<readonly DayAggregate[]>([]);
  private readonly panoramaLoadingSignal = signal(false);
  protected readonly panoramaLoading = this.panoramaLoadingSignal.asReadonly();
  private panoramaFetchedForLoad = false;
  // why: el plan pide techo dinámico ~40% del viewport para que la silueta
  // respire y se lea como paisaje. El resize se lee al arrancar y al
  // hidratar aggregate; suficiente para el uso real (no monitoreamos resize).
  private readonly panoramaViewportH = signal(
    typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.4) : 260,
  );
  protected readonly panoramaGeometry = computed<PanoramaGeometry>(() => {
    const H = Math.max(160, this.panoramaViewportH());
    return computePanoramaGeometry(this.panoramaAggregatesSignal(), { height: H });
  });
  protected readonly panoramaFossils = computed<readonly PanoramaFossil[]>(() => {
    const geo = this.panoramaGeometry();
    const entries = this.entries();
    const byOid = this.milestonesByOid();
    const dayByOid = new Map<string, number>();
    for (const e of entries) dayByOid.set(e.oid, startOfDayMs(e.date.getTime()));
    const flat: { oid: string; name: string; dayStart: number }[] = [];
    for (const [oid, ms] of byOid) {
      const day = dayByOid.get(oid);
      if (day === undefined) continue;
      for (const m of ms) flat.push({ oid, name: m.name, dayStart: day });
    }
    return panoramaFossils(geo, flat);
  });

  // Detail (cordel): polaroids en tira horizontal. Un signal separado sigue
  // qué polaroids ya "revelaron" su diff (via HistoryDiffService.loadForCommit).
  // Al entrar al zoom detail, hidratamos las primeras N; el resto se hidrata
  // on-hover/on-scroll para no golpear git con 200 llamadas en paralelo.
  private readonly revealedOidsSignal = signal<ReadonlySet<string>>(new Set());
  private readonly revealingOidsSignal = signal<ReadonlySet<string>>(new Set());
  protected isPolaroidRevealed(oid: string): boolean {
    return this.revealedOidsSignal().has(oid);
  }
  protected isPolaroidRevealing(oid: string): boolean {
    return this.revealingOidsSignal().has(oid);
  }
  protected readonly revealingCount = computed(() => this.revealingOidsSignal().size);
  protected readonly revealedCount = computed(() => this.revealedOidsSignal().size);
  protected readonly polaroids = computed<readonly CommitEntry[]>(() => {
    const noise = this.noiseOidsSignal();
    const byOid = this.milestonesByOid();
    return this.entries().filter((e) => byOid.has(e.oid) || !noise.has(e.oid));
  });
  protected revealPolaroid(entry: CommitEntry): void {
    const oid = entry.oid;
    if (this.revealedOidsSignal().has(oid) || this.revealingOidsSignal().has(oid)) return;
    this.revealingOidsSignal.update((s) => new Set(s).add(oid));
    void this.diff
      .loadForCommit(oid)
      .then(() => {
        this.revealedOidsSignal.update((s) => new Set(s).add(oid));
      })
      .catch((e: unknown) => this.errors.report(e))
      .finally(() => {
        this.revealingOidsSignal.update((s) => {
          const next = new Set(s);
          next.delete(oid);
          return next;
        });
      });
  }

  // why: marker de HEAD (commit actual) en la cordillera: la cumbre "más
  // reciente" según fecha. Ayuda a orientarse en el paisaje sin necesidad
  // de scroll ni leer nombres. Devuelve la columna que contiene HEAD.
  protected readonly panoramaHeadColumn = computed(() => {
    const head = this.headOid();
    if (!head) return null;
    const entry = this.entries().find((e) => e.oid === head);
    if (!entry) return null;
    const day = startOfDayMs(entry.date.getTime());
    return this.panoramaGeometry().columns.find((c) => c.dayStart === day) ?? null;
  });

  // why: el excursionista es el "vos, naturalista" en el paisaje. Se
  // planta en la cumbre de HEAD por defecto (donde estás trabajando) y
  // camina hacia la cumbre que el usuario seleccione. Al deseleccionar
  // vuelve a HEAD. Es la única forma de "moverse por la cordillera" sin
  // mentir sobre la semántica del zoom.
  protected readonly panoramaExplorerColumn = computed(() => {
    return this.panoramaSelectedColumn() ?? this.panoramaHeadColumn();
  });

  // why: la posición renderizada del excursionista sale de una animación
  // RAF que muestrea las columnas intermedias entre origen y destino, en
  // vez de interpolar linealmente. Así el personaje camina siguiendo la
  // silueta real de la cordillera — sube al pico, baja al valle, no
  // corta las montañas en diagonal.
  protected readonly explorerPos = signal<{
    xPct: number;
    yPct: number;
    walking: boolean;
  } | null>(null);
  private explorerRafId: number | null = null;

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
    // encontrar la columna más cercana a la posición actual (índice de origen)
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
    // ~110ms por columna, techo 3200ms — se ve caminar, no teletransportarse.
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

  // why: click en la cordillera "elige" un día — pone la guía visual y
  // alimenta la libreta del rango (task 20). No cambia el zoom.
  private readonly panoramaSelectedDayStartSignal = signal<number | null>(null);
  protected readonly panoramaSelectedDayStart = this.panoramaSelectedDayStartSignal.asReadonly();
  protected readonly panoramaSelectedColumn = computed(() => {
    const sel = this.panoramaSelectedDayStartSignal();
    if (sel === null) return null;
    return this.panoramaGeometry().columns.find((c) => c.dayStart === sel) ?? null;
  });
  protected setPanoramaSelectedDay(dayStart: number): void {
    this.panoramaSelectedDayStartSignal.set(dayStart);
  }

  // why: en zoom estratos, la "ficha de yacimiento" es el resumen del
  // ESTRATO donde cayó el commit seleccionado — total, mix por faceta,
  // fósiles y lista scrollable de commits. El diff sólo aparece cuando
  // el usuario baja a cordel (double-click o selección en la lista).
  protected readonly selectedStratum = computed<Stratum | null>(() => {
    const list = this.strata();
    const oid = this.selectedOidSignal();
    if (!oid) return list[0] ?? null;
    const containsOid = (s: Stratum): boolean =>
      s.items.some((it) =>
        it.kind === 'commit' ? it.entry.oid === oid : it.members.some((m) => m.oid === oid),
      );
    return list.find(containsOid) ?? list[0] ?? null;
  });

  protected stratumFacetPct(mix: Record<Facet, number>, f: Facet): number {
    const total = Math.max(1, mix.main + mix.comments + mix.draft);
    return Math.round((mix[f] / total) * 100);
  }

  protected scrollToActiveStratum(): void {
    const s = this.selectedStratum();
    if (!s) return;
    queueMicrotask(() => {
      document
        .querySelector<HTMLElement>(`[data-stratum-id="${s.id}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  // why: la lista scrollable de commits en la ficha aplasta merge/auto-groups
  // a sus miembros. Cada uno es clickable → zoomIntoCommit baja a cordel.
  protected flattenStratumCommits(s: Stratum): readonly CommitEntry[] {
    const out: CommitEntry[] = [];
    for (const item of s.items) {
      if (item.kind === 'commit') out.push(item.entry);
      else for (const m of item.members) out.push(m);
    }
    return out;
  }

  // why: la libreta de campo (task 20) muestra el resumen del RANGO — no un
  // commit individual. Deriva de los entries del día seleccionado.
  protected readonly panoramaRangeSummary = computed(() => {
    const day = this.panoramaSelectedDayStartSignal();
    if (day === null) return null;
    const entriesOfDay = this.entries().filter((e) => startOfDayMs(e.date.getTime()) === day);
    const facetMix: Record<Facet, number> = { main: 0, comments: 0, draft: 0 };
    for (const e of entriesOfDay) facetMix[facetOf(e.message)]++;
    const byOid = this.milestonesByOid();
    const fossils: { oid: string; name: string }[] = [];
    for (const e of entriesOfDay) {
      const ms = byOid.get(e.oid);
      if (ms) for (const m of ms) fossils.push({ oid: e.oid, name: m.name });
    }
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

  protected panoramaFacetPct(mix: Record<Facet, number>, f: Facet): number {
    const total = Math.max(1, mix.main + mix.comments + mix.draft);
    return Math.round((mix[f] / total) * 100);
  }

  protected panoramaZoomIntoRange(): void {
    const day = this.panoramaSelectedDayStartSignal();
    if (day !== null) this.onPanoramaColumnActivate(day);
  }

  protected onPanoramaColumnActivate(dayStart: number): void {
    // why: doble-click en columna baja a estratos y foca el commit más nuevo
    //      de ese día — así el usuario aterriza en rango exacto. Al bajar
    //      desbloqueamos también el paso siguiente (cordel) porque el
    //      target ES una veta concreta, no una elección casual.
    const target = this.entries().find((e) => startOfDayMs(e.date.getTime()) === dayStart);
    this.unlockUpTo('strata');
    this.zoomSignal.set('strata');
    if (target) {
      this.selectedOidSignal.set(target.oid);
      queueMicrotask(() => {
        document
          .getElementById(`commit-${target.oid}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }

  // why: progressive mount. Header + fossils of every stratum paint at the
  //      first tick; the commit list of each bucket only mounts once the
  //      stratum enters the viewport. The set is monotonically-growing
  //      per view (no unmount on scroll away) to keep [ / ] milestone
  //      navigation cheap and predictable.
  private readonly hydratedBucketsSignal = signal<ReadonlySet<BucketId>>(new Set(['today']));
  protected isBucketHydrated(id: BucketId): boolean {
    return this.hydratedBucketsSignal().has(id);
  }
  private stratumObserver: IntersectionObserver | null = null;

  // why: la "roca" del estrato usa la escala log del thicknessPx (20–96)
  // pero pide más aire vertical para que las tres franjas se distingan
  // — mapeamos 20→40 y 96→140. Empíricamente, por debajo de 40px las
  // franjas se aplastan y no se leen como sedimento.
  protected stratumRockHeightPx(d: StratumDensity): number {
    const t = d.thicknessPx;
    return Math.round(40 + ((t - 20) / (96 - 20)) * 100);
  }

  private readonly expandedMergeGroupsSignal = signal<Set<string>>(new Set());
  protected isMergeGroupExpanded(id: string): boolean {
    return this.expandedMergeGroupsSignal().has(id);
  }
  protected toggleMergeGroup(id: string): void {
    this.expandedMergeGroupsSignal.update((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  private readonly expandedAutoGroupsSignal = signal<Set<string>>(new Set());
  protected isAutoGroupExpanded(id: string): boolean {
    return this.expandedAutoGroupsSignal().has(id);
  }
  protected toggleAutoGroup(id: string): void {
    this.expandedAutoGroupsSignal.update((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // why: el "asunto" del líder del grupo es el mensaje del último commit
  //      sin el "(N comentarios)" o "(2026-06-14 17:00) [reason]" final,
  //      que cambia commit a commit y por eso disminuye legibilidad.
  protected autoGroupSubject(message: string): string {
    const m = /^auto(\s+\[[^\]]+\])?:\s*(.+?)\s*(?:\(|$)/.exec(message);
    if (!m) return message;
    const facet = m[1] ?? '';
    const body = m[2]!.trim();
    return `auto${facet}: ${body}`;
  }

  protected milestonesFor(oid: string): readonly MilestoneEntry[] {
    return this.milestonesByOid().get(oid) ?? [];
  }

  private readonly selectedOidSignal = signal<string | null>(null);
  protected readonly selectedOid = this.selectedOidSignal.asReadonly();
  protected readonly selectedEntry = computed<CommitEntry | null>(() => {
    const oid = this.selectedOidSignal();
    if (!oid) return null;
    return this.entries().find((e) => e.oid === oid) ?? null;
  });

  // Split the commit message into its subject (first line) and trailer
  // block (the rest). The h3 only shows the subject so multi-line merge
  // messages don't crush together; trailers go into a collapsible
  // section below the header.
  protected readonly selectedSubject = computed<string>(() => {
    const m = this.selectedEntry()?.message ?? '';
    const idx = m.indexOf('\n');
    return idx === -1 ? m : m.slice(0, idx);
  });
  protected readonly selectedBody = computed<string>(() => {
    const m = this.selectedEntry()?.message ?? '';
    const idx = m.indexOf('\n');
    return idx === -1 ? '' : m.slice(idx + 1).trim();
  });

  private readonly entityDiffsSignal = signal<readonly EntityDiff[]>([]);
  private readonly diffLoadingSignal = signal(false);
  private readonly expandedPathSignal = signal<string | null>(null);
  protected readonly entityDiffs = this.entityDiffsSignal.asReadonly();
  protected readonly diffLoading = this.diffLoadingSignal.asReadonly();
  protected readonly expandedPath = this.expandedPathSignal.asReadonly();

  // Summary + group-by-type for the detail pane. Counters from entity status;
  // groups from the path's first segment so the user can scan "what was
  // touched" before drilling into individual files.
  private readonly groupByTypeSignal = signal(false);
  protected readonly groupByType = this.groupByTypeSignal.asReadonly();
  protected toggleGroupByType(): void {
    this.groupByTypeSignal.update((v) => !v);
  }
  protected readonly diffSummary = computed(() => {
    const diffs = this.entityDiffsSignal();
    let added = 0;
    let modified = 0;
    let deleted = 0;
    for (const d of diffs) {
      if (d.status === 'added') added++;
      else if (d.status === 'deleted') deleted++;
      else modified++;
    }
    return { total: diffs.length, added, modified, deleted };
  });
  protected readonly groupedDiffs = computed<
    readonly { key: GroupKey; items: readonly EntityDiff[] }[]
  >(() => {
    const diffs = this.entityDiffsSignal();
    const buckets = new Map<GroupKey, EntityDiff[]>();
    for (const d of diffs) {
      const key = groupKeyForPath(d.filepath);
      const arr = buckets.get(key) ?? [];
      arr.push(d);
      buckets.set(key, arr);
    }
    return GROUP_ORDER.filter((k) => buckets.has(k)).map((k) => ({
      key: k,
      items: buckets.get(k)!,
    }));
  });
  // why: flat list of "headers + entities" so the template iterates with a
  //      single @for and avoids duplicating the entity row markup. When
  //      groupByType is off we just emit entities back-to-back.
  protected readonly entityFeed = computed<readonly EntityFeedRow[]>(() => {
    if (!this.groupByTypeSignal()) {
      return this.entityDiffsSignal().map((d) => ({ kind: 'entity', diff: d, id: d.filepath }));
    }
    const rows: EntityFeedRow[] = [];
    for (const g of this.groupedDiffs()) {
      rows.push({ kind: 'header', key: g.key, id: `h:${g.key}`, count: g.items.length });
      for (const d of g.items) rows.push({ kind: 'entity', diff: d, id: d.filepath });
    }
    return rows;
  });
  protected groupLabelKey(k: GroupKey): TranslationKey {
    return `versioning.history.summary.group.${k}`;
  }

  constructor() {
    // why: cada vez que cambia el set de estratos visibles (filtros, load
    //      inicial), reobservamos el DOM para que buckets nuevos hidraten
    //      al entrar al viewport. Untracked la lectura del signal de
    //      hidratados: sólo depende de `strata()`.
    effect(() => {
      const strata = this.strata();
      queueMicrotask(() => {
        this.rebindStratumObserver(strata.map((s) => s.id));
      });
    });
    // why: al subir a panorámica por primera vez tras cada reloadAll,
    //      buscamos el aggregate por día. Se cachea hasta el próximo reload.
    effect(() => {
      const z = this.zoomSignal();
      if (z !== 'panorama' || this.panoramaFetchedForLoad) return;
      this.panoramaFetchedForLoad = true;
      this.panoramaLoadingSignal.set(true);
      void this.loader
        .loadWindow({ resolution: 'aggregate' })
        .then((w) => this.panoramaAggregatesSignal.set(w.aggregate))
        .catch((e: unknown) => this.errors.report(e))
        .finally(() => this.panoramaLoadingSignal.set(false));
    });

    // why: al entrar al cordel, hidratamos las primeras polaroids al toque
    //      para que el "revelado" arranque solo — resto on-hover/on-scroll.
    effect(() => {
      if (this.zoomSignal() !== 'detail') return;
      const list = untracked(() => this.polaroids());
      for (const e of list.slice(0, 6)) this.revealPolaroid(e);
    });

    // why: mueve al excursionista siguiendo la silueta cuando cambia la
    //      columna destino. La interpolación pasa por cada columna
    //      intermedia — con easing cubic-in-out — así el paso "sube y
    //      baja" con la cordillera en vez de cortar recto. Envolvemos el
    //      cuerpo en untracked porque el RAF escribe explorerPos en cada
    //      frame; sin untracked el effect se re-dispararía en loop y
    //      cancelaría su propio RAF antes de moverse.
    effect(() => {
      const target = this.panoramaExplorerColumn();
      const geo = this.panoramaGeometry();
      untracked(() => {
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
    });

    effect(() => {
      const oid = this.selectedOidSignal();
      this.entityDiffsSignal.set([]);
      this.expandedPathSignal.set(null);
      if (!oid) return;
      this.diffLoadingSignal.set(true);
      void this.diff
        .loadForCommit(oid)
        .then((diffs) => {
          if (this.selectedOidSignal() !== oid) return;
          this.entityDiffsSignal.set(diffs);
          const first = diffs[0];
          if (first) this.expandedPathSignal.set(first.filepath);
        })
        .catch((e: unknown) => this.errors.report(e))
        .finally(() => {
          if (this.selectedOidSignal() === oid) this.diffLoadingSignal.set(false);
        });
    });
  }

  private unregisterShortcuts: (() => void)[] = [];

  ngOnInit(): void {
    void this.reloadAll(true);
    // why: +/- cambia el zoom semántico; Esc sube un nivel. Editable-safe
    //      para no colisionar con el buscador ni con inputs de milestone.
    this.unregisterShortcuts.push(
      this.shortcuts.register({
        combo: '+',
        labelKey: 'versioning.history.zoom.shortcutIn',
        scope: 'editable-safe',
        handler: () => this.stepZoom(1),
      }),
      this.shortcuts.register({
        combo: '-',
        labelKey: 'versioning.history.zoom.shortcutOut',
        scope: 'editable-safe',
        handler: () => this.stepZoom(-1),
      }),
      this.shortcuts.register({
        combo: 'escape',
        labelKey: 'versioning.history.zoom.shortcutUp',
        scope: 'editable-safe',
        handler: () => this.stepZoom(-1),
      }),
    );
  }

  ngOnDestroy(): void {
    this.stratumObserver?.disconnect();
    this.stratumObserver = null;
    this.noiseScanAbort?.abort();
    this.cancelExplorerAnimation();
    for (const fn of this.unregisterShortcuts) fn();
    this.unregisterShortcuts = [];
  }

  private rebindStratumObserver(visibleIds: readonly BucketId[]): void {
    const host = this.hostRef.nativeElement;
    if (!('IntersectionObserver' in window)) {
      // why: sin observer soportado, hidratamos todo — degradación honesta.
      untracked(() => this.hydratedBucketsSignal.set(new Set(visibleIds)));
      return;
    }
    if (!this.stratumObserver) {
      this.stratumObserver = new IntersectionObserver(
        (entries) => {
          const additions: BucketId[] = [];
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            const id = (e.target as HTMLElement).dataset['stratumId'] as BucketId | undefined;
            if (id) additions.push(id);
          }
          if (additions.length === 0) return;
          this.hydratedBucketsSignal.update((prev) => {
            const next = new Set(prev);
            for (const id of additions) next.add(id);
            if (next.size === prev.size) return prev;
            return next;
          });
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            this.stratumObserver?.unobserve(e.target);
          }
        },
        { root: host.querySelector('.timeline'), rootMargin: '240px 0px' },
      );
    }
    const nodes = host.querySelectorAll<HTMLElement>('[data-stratum-id]');
    for (const n of Array.from(nodes)) this.stratumObserver.observe(n);
  }

  // why: cada reload dispara una nueva "generación" de scan de ruido; la
  //      generación vieja se aborta si sigue corriendo. Sin esto, un
  //      restore rápido dejaría dos scans compitiendo por escribir sobre
  //      el mismo signal.
  private noiseScanCounter = 0;
  private noiseScanAbort: AbortController | null = null;

  // why: el sondeo de "ruido" debe re-ejecutarse después de cada load(),
  //      incluidos los que disparan los restore. Fase 1.5: la scan ya no
  //      bloquea el critical path — el timeline pinta al toque, el noise
  //      se marca en batches y si el commit seleccionado inicial resulta
  //      ruido lo movemos al siguiente visible en cuanto ese oid aparece.
  private async reloadAll(selectFirst: boolean): Promise<void> {
    await this.history.load();
    // why: invalidamos cache de panorama y polaroids reveladas — el conjunto
    //      de commits cambió, cualquier prefetch anterior podría estar mal.
    this.panoramaFetchedForLoad = false;
    this.panoramaAggregatesSignal.set([]);
    this.revealedOidsSignal.set(new Set());
    this.revealingOidsSignal.set(new Set());
    const all = this.entries();
    // why: deep-links from /variants (`?oid=<sha>`) and external tools
    //      hand us a specific commit to focus. If we resolve it, skip
    //      the "first visible" heuristic so the page lands where the
    //      caller pointed; otherwise fall through to default behavior.
    const requested = this.route.snapshot.queryParamMap.get('oid');
    const matched = requested ? all.find((e) => e.oid === requested) : null;
    if (matched) {
      this.selectedOidSignal.set(matched.oid);
      queueMicrotask(() => {
        document
          .getElementById(`commit-${matched.oid}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    } else if (selectFirst) {
      const first = all[0];
      if (first) this.selectedOidSignal.set(first.oid);
    }
    this.scanNoiseInBackground(all, selectFirst && !matched);
  }

  private scanNoiseInBackground(all: readonly CommitEntry[], fixupSelection: boolean): void {
    this.noiseScanAbort?.abort();
    const generation = ++this.noiseScanCounter;
    const abort = new AbortController();
    this.noiseScanAbort = abort;
    this.noiseOidsSignal.set(new Set());
    const applyBatch = (found: ReadonlySet<string>): void => {
      if (this.noiseScanCounter !== generation) return;
      this.noiseOidsSignal.set(found);
      // why: si el commit seleccionado inicial cayó dentro del ruido
      //      recién detectado, empujamos al siguiente visible. No
      //      tocamos deep-links (fixupSelection=false) ni selecciones
      //      manuales del usuario posteriores al load.
      if (!fixupSelection) return;
      const current = this.selectedOidSignal();
      if (current && found.has(current)) {
        const visible = all.find((e) => !found.has(e.oid));
        if (visible) this.selectedOidSignal.set(visible.oid);
      }
    };
    void this.diff
      .findNoiseCommits(all, { signal: abort.signal, onBatch: applyBatch })
      .then((final) => applyBatch(final))
      .catch((e: unknown) => {
        if (this.noiseScanCounter === generation) this.errors.report(e);
      });
  }

  protected toggleExpanded(path: string): void {
    this.expandedPathSignal.update((p) => (p === path ? null : path));
  }

  private readonly systemExpandedSignal = signal<Set<string>>(new Set());
  protected isSystemExpanded(path: string): boolean {
    return this.systemExpandedSignal().has(path);
  }
  protected toggleSystemExpanded(path: string): void {
    this.systemExpandedSignal.update((s) => {
      const next = new Set(s);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  protected facetOfMessage(message: string): Facet {
    return facetOf(message);
  }

  protected anchoredBadge(status: AnchorChangeStatus): string {
    if (status === 'added') return '+';
    if (status === 'removed') return '−';
    return '✎';
  }

  protected anchoredStatusLabel(mode: AnchorMode, status: AnchorChangeStatus): string {
    const prefix = mode === 'drafts' ? 'draft' : 'comment';
    const suffix = status === 'added' ? 'Added' : status === 'removed' ? 'Removed' : 'Modified';
    return this.i18n.t(`versioning.history.anchored.${prefix}${suffix}` as TranslationKey);
  }

  protected anchoredAnchorLabel(anchorType: string): string {
    if (anchorType === 'block') return this.i18n.t('versioning.history.anchored.anchorBlock');
    if (anchorType === 'doc') return this.i18n.t('versioning.history.anchored.anchorDoc');
    if (anchorType === 'entity') return this.i18n.t('versioning.history.anchored.anchorEntity');
    return anchorType;
  }

  protected formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  protected bucketLabel(id: BucketId): string {
    return this.i18n.t(BUCKET_LABEL_KEY[id]);
  }

  protected select(oid: string): void {
    this.selectedOidSignal.set(oid);
  }

  // why: doble-click en un commit del corte estratigráfico baja al cordel
  //      con esa polaroid centrada. Un nivel a la vez — nunca salta panorama
  //      → detail.
  protected zoomIntoCommit(oid: string): void {
    this.selectedOidSignal.set(oid);
    this.unlockUpTo('detail');
    this.zoomSignal.set('detail');
    queueMicrotask(() => {
      document
        .getElementById(`polaroid-${oid}`)
        ?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    });
  }

  protected zoomLabelKey(z: HistoryZoom): TranslationKey {
    return `versioning.history.zoom.${z}` as TranslationKey;
  }

  protected panoramaColumnTitle(dayStart: number, count: number): string {
    return this.i18n.t('versioning.history.panorama.columnTitle', {
      date: new Date(dayStart).toLocaleDateString(),
      n: count,
    });
  }

  // Keyboard nav between milestones: '[' previous, ']' next. Bracket-keys are
  // a stable choice across keyboard layouts and don't collide with the inputs
  // inside the timeline head.
  @HostListener('document:keydown', ['$event'])
  protected onKeydown(ev: KeyboardEvent): void {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const target = ev.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    if (target?.isContentEditable) return;
    if (ev.key !== '[' && ev.key !== ']') return;
    const direction = ev.key === ']' ? 1 : -1;
    // why: en cordel [/] navega polaroid a polaroid (no sólo milestones).
    //      Fósiles siguen destacados visualmente en la tira.
    const target_ =
      this.zoomSignal() === 'detail'
        ? this.findAdjacentCommit(direction)
        : this.findAdjacentMilestone(direction);
    if (!target_) return;
    ev.preventDefault();
    this.selectedOidSignal.set(target_);
    queueMicrotask(() => {
      document
        .getElementById(`commit-${target_}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  private findAdjacentCommit(direction: 1 | -1): string | null {
    const list = this.polaroids();
    if (list.length === 0) return null;
    const current = this.selectedOidSignal();
    const idx = current ? list.findIndex((e) => e.oid === current) : -1;
    if (idx === -1) return list[0]!.oid;
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= list.length) return null;
    return list[nextIdx]!.oid;
  }

  private findAdjacentMilestone(direction: 1 | -1): string | null {
    const entries = this.entries();
    const byOid = this.milestonesByOid();
    const oids = entries.map((e) => e.oid);
    const milestoneIndices: number[] = [];
    oids.forEach((oid, idx) => {
      if (byOid.has(oid)) milestoneIndices.push(idx);
    });
    if (milestoneIndices.length === 0) return null;
    const current = this.selectedOidSignal();
    const currentIdx = current ? oids.indexOf(current) : -1;
    if (currentIdx === -1) {
      return oids[direction === 1 ? milestoneIndices[0]! : milestoneIndices.at(-1)!]!;
    }
    if (direction === 1) {
      const next = milestoneIndices.find((i) => i > currentIdx);
      return next !== undefined ? oids[next]! : null;
    }
    const prev = [...milestoneIndices].reverse().find((i) => i < currentIdx);
    return prev !== undefined ? oids[prev]! : null;
  }

  private readonly restoringPathSignal = signal<string | null>(null);
  protected readonly restoringPath = this.restoringPathSignal.asReadonly();
  private readonly restoringCommitSignal = signal(false);
  protected readonly restoringCommit = this.restoringCommitSignal.asReadonly();

  protected async restoreEntity(d: EntityDiff, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    const entry = this.selectedEntry();
    if (!entry) return;
    if (this.restoringPathSignal() !== null) return;
    const mode = d.status === 'deleted' ? 'absent' : 'present';
    const key =
      mode === 'absent'
        ? 'versioning.history.restoreEntityDeleteConfirm'
        : 'versioning.history.restoreEntityConfirm';
    const message = this.i18n.t(key, { path: d.filepath, shortOid: entry.shortOid });
    // why: a confirm() is enough here — restore is reversible by selecting a
    //      newer commit. Strong modal is reserved for the per-commit restore
    //      that touches many entities at once.
    if (!window.confirm(message)) return;
    this.restoringPathSignal.set(d.filepath);
    try {
      await this.restore.restoreEntity(entry.oid, d.filepath, mode);
      await this.reloadAll(true);
    } catch (e) {
      this.errors.report(e);
    } finally {
      this.restoringPathSignal.set(null);
    }
  }

  protected markMilestone(): void {
    const entry = this.selectedEntry();
    if (!entry) return;
    void this.milestones.mark(entry.oid);
  }

  protected async restoreWholeCommit(): Promise<void> {
    const entry = this.selectedEntry();
    if (!entry) return;
    if (this.restoringCommitSignal()) return;
    const prompt = this.i18n.t('versioning.history.restoreCommitPrompt', {
      shortOid: entry.shortOid,
    });
    const typed = window.prompt(prompt);
    if (typed === null) return;
    if (typed.trim() !== entry.shortOid) {
      window.alert(this.i18n.t('versioning.history.restoreCommitMismatch'));
      return;
    }
    this.restoringCommitSignal.set(true);
    try {
      await this.restore.restoreCommit(entry.oid);
      await this.reloadAll(true);
    } catch (e) {
      this.errors.report(e);
    } finally {
      this.restoringCommitSignal.set(false);
    }
  }
}
