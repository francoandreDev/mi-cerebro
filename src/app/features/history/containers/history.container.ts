import type { OnDestroy, OnInit } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { ErrorService } from '@core/errors/error.service';
import { I18nService } from '@core/i18n/i18n.service';
import { ShortcutsService } from '@core/shortcuts/shortcuts.service';
import { TutorialService } from '@core/tutorials/tutorial.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { IconComponent } from '@shared/icon/icon.component';

import { HistoryPanoramaComponent } from '../components/history-panorama.component';
import type { FlatFossil } from '../components/history-panorama.component';
import { HistoryStrataComponent } from '../components/history-strata.component';
import { HistoryCordelComponent } from '../components/history-cordel.component';
import { HISTORY_RESTORE_TUTORIAL } from './history-restore.tutorial';
import { HISTORY_TUTORIAL } from './history.tutorial';
import { HistoryDiffService } from '../services/diff.service';
import type { EntityDiff } from '../services/diff.service';
import { ALL_FACETS, facetOf, type Facet } from '../services/facet';
import { HistoryLoader } from '../services/history-loader.service';
import type { DayAggregate } from '../services/history-loader.service';
import { HistoryService } from '../services/history.service';
import type {
  BucketId,
  CommitBucket,
  CommitEntry,
  DiffSummary,
  HoverPreview,
  TimelineItem,
} from '../services/history.types';
import { MilestoneController } from '../services/milestone.controller';
import { readSS, writeSS } from '../services/session-store';
import {
  EMPTY_DENSITY,
  computeDensity,
  computeStratumLayers,
  startOfDayMs,
} from '../services/strata.utils';
import type { StratumDensity, StratumLayers } from '../services/strata.utils';

export type GroupKey = 'notes' | 'tasks' | 'books' | 'drafts' | 'comments' | 'meta' | 'other';

export type HistoryZoom = 'panorama' | 'strata' | 'detail';
const ZOOM_ORDER: readonly HistoryZoom[] = ['panorama', 'strata', 'detail'];

// why: nombres en español para deep-link `?zoom=` porque el resto de las
//      rutas del proyecto se comparten así ("deep-link cerebro" es lectura
//      humana). El tipo interno queda en inglés.
const ZOOM_URL_TO_INTERNAL: Record<string, HistoryZoom> = {
  panoramica: 'panorama',
  media: 'strata',
  detalle: 'detail',
};
const ZOOM_INTERNAL_TO_URL: Record<HistoryZoom, string> = {
  panorama: 'panoramica',
  strata: 'media',
  detail: 'detalle',
};

// why: keys de sessionStorage para el "rango visible" que sigue viviendo
//      en el container (cross-zoom). panoramaDay y compactDiff se movieron
//      a sus componentes respectivos (session-store.ts sigue siendo la
//      utilidad compartida de lectura/escritura).
const SS_KEY = {
  query: 'mc:history:query',
  facets: 'mc:history:facets',
  onlyMile: 'mc:history:onlyMilestones',
  selOid: 'mc:history:selOid',
} as const;

const FOSSIL_FOCUS_HALF_MS = 12 * 60 * 60 * 1000;

// why: hover sostenido antes de mostrar el preview — evita recomputar/parpadear
//      mientras el mouse sólo está de paso por la tira de polaroids.
const HOVER_PREVIEW_DELAY_MS = 400;
const HOVER_PREVIEW_MAX_PATHS = 4;
const EMPTY_DIFF_SUMMARY: DiffSummary = { total: 0, added: 0, modified: 0, deleted: 0 };

function summarizeDiffs(diffs: readonly EntityDiff[]): DiffSummary {
  let added = 0;
  let modified = 0;
  let deleted = 0;
  for (const d of diffs) {
    if (d.status === 'added') added++;
    else if (d.status === 'deleted') deleted++;
    else modified++;
  }
  return { total: diffs.length, added, modified, deleted };
}

interface PersistedState {
  query: string;
  facets: readonly Facet[] | null;
  onlyMilestones: boolean;
  selectedOid: string | null;
}

function readPersistedState(): PersistedState {
  const rawFacets = readSS(SS_KEY.facets);
  let facets: readonly Facet[] | null = null;
  if (rawFacets) {
    try {
      const parsed = JSON.parse(rawFacets) as unknown;
      if (Array.isArray(parsed)) {
        const clean = parsed.filter((x): x is Facet => ALL_FACETS.includes(x as Facet));
        if (clean.length > 0) facets = clean;
      }
    } catch {
      // ignore malformed json
    }
  }
  return {
    query: readSS(SS_KEY.query) ?? '',
    facets,
    onlyMilestones: readSS(SS_KEY.onlyMile) === '1',
    selectedOid: readSS(SS_KEY.selOid),
  };
}

export interface Stratum {
  readonly id: BucketId;
  readonly items: readonly TimelineItem[];
  readonly density: StratumDensity;
  readonly layers: StratumLayers;
}

export type EntityFeedRow =
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
  imports: [
    IconComponent,
    HistoryPanoramaComponent,
    HistoryStrataComponent,
    HistoryCordelComponent,
  ],
  templateUrl: './history.container.html',
  styleUrl: './history.container.css',
})
export class HistoryContainer implements OnInit, OnDestroy {
  private readonly history = inject(HistoryService);
  private readonly loader = inject(HistoryLoader);
  private readonly diff = inject(HistoryDiffService);
  protected readonly milestones = inject(MilestoneController);
  private readonly errors = inject(ErrorService);
  protected readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly shortcuts = inject(ShortcutsService);
  private readonly tutorials = inject(TutorialService);

  private readonly persisted = readPersistedState();
  // why: deep-link `?zoom=` se lee en el ctor para poder sembrar el zoom
  //      inicial ANTES de que el effect de sync URL-zoom dispare — si no,
  //      el effect pisa la URL con el default 'media' y perdemos el
  //      deep-link. Undefined = respetar default estratos.
  private readonly initialZoomFromUrl: HistoryZoom | null = (() => {
    const raw = this.route.snapshot.queryParamMap.get('zoom');
    return raw && raw in ZOOM_URL_TO_INTERNAL ? ZOOM_URL_TO_INTERNAL[raw]! : null;
  })();

  protected readonly loading = this.history.loading;
  protected readonly error = this.history.error;
  protected readonly entries = this.history.entries;
  protected readonly headOid = this.history.headOid;
  protected readonly milestonesByOid = this.history.milestonesByOid;
  protected readonly originByOid = this.history.originByOid;
  protected readonly variantsById = this.history.variantsById;

  private readonly onlyMilestonesSignal = signal(this.persisted.onlyMilestones);
  protected readonly onlyMilestones = this.onlyMilestonesSignal.asReadonly();
  protected toggleOnlyMilestones(): void {
    this.onlyMilestonesSignal.update((v) => !v);
  }

  // Free-text search over the timeline. Tokens:
  //  - facet:main|comments|draft  → faceta filter (also AND'd with chips)
  //  - since:Nd                    → solo commits con date ≥ ahora − N días
  //  - sha o sha:abc1234           → match por shortOid
  //  - cualquier otro token        → substring case-insensitive en el mensaje
  protected readonly query = signal(this.persisted.query);
  protected onQueryChange(value: string): void {
    this.query.set(value);
  }
  protected clearQuery(): void {
    this.query.set('');
  }
  private readonly parsedQuery = computed<ParsedQuery>(() => parseSearchQuery(this.query()));

  // Faceta filter: chips at the top of the timeline let the user collapse
  // by branch family (main / comentarios / borrador). Default is all-on.
  // The set is constrained never to be empty so the user can't accidentally
  // hide everything by toggling the last chip off.
  protected readonly allFacets = ALL_FACETS;
  private readonly enabledFacetsSignal = signal<ReadonlySet<Facet>>(
    new Set(this.persisted.facets ?? ALL_FACETS),
  );
  protected readonly enabledFacets = this.enabledFacetsSignal.asReadonly();
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

  protected readonly noResults = computed(() => this.buckets().length === 0);

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
  // why: Fase 5 — el zoom NO persiste; default siempre estratos ("medio") para
  //      que el usuario nunca aterrice en una vista rara al volver. Deep-link
  //      `?zoom=` se lee en el ctor y siembra el valor inicial para no
  //      chocar con el effect que refleja el zoom en la URL.
  private readonly zoomSignal = signal<HistoryZoom>(this.initialZoomFromUrl ?? 'strata');
  protected readonly zoom = this.zoomSignal.asReadonly();
  protected readonly zoomOrder = ZOOM_ORDER;
  // why: los niveles son secuenciales — la única forma de bajar al siguiente
  // es haciendo la acción del anterior (seleccionar día en cordillera para
  // desbloquear estratos; seleccionar veta en estratos para desbloquear
  // cordel). Ir hacia atrás siempre está permitido.
  private readonly unlockedLevelSignal = signal<HistoryZoom>(this.initialZoomFromUrl ?? 'strata');
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
  protected zoomLabelKey(z: HistoryZoom): TranslationKey {
    return `versioning.history.zoom.${z}` as TranslationKey;
  }
  // why: la pill de zoom sólo nombraba el nivel ACTIVO — la leyenda siempre
  //      visible debajo del header nombra los tres niveles a la vez.
  protected zoomLegendKey(z: HistoryZoom): TranslationKey {
    return `versioning.history.zoom.legend.${z}` as TranslationKey;
  }
  private stepZoom(delta: 1 | -1): void {
    const cur = this.zoomSignal();
    const idx = ZOOM_ORDER.indexOf(cur);
    const next = ZOOM_ORDER[Math.min(ZOOM_ORDER.length - 1, Math.max(0, idx + delta))];
    if (next && next !== cur && this.canEnterZoom(next)) this.zoomSignal.set(next);
  }

  // Panorama data (aggregate por día). Se hidrata off critical path la
  // primera vez que el usuario sube al zoom cordillera (o entra a estratos,
  // que reutiliza el mismo aggregate para el minimapa); cachea el resultado
  // por sesión hasta que ocurra un reloadAll().
  private readonly panoramaAggregatesSignal = signal<readonly DayAggregate[]>([]);
  protected readonly panoramaAggregates = this.panoramaAggregatesSignal.asReadonly();
  private readonly panoramaLoadingSignal = signal(false);
  protected readonly panoramaLoading = this.panoramaLoadingSignal.asReadonly();
  private panoramaFetchedForLoad = false;

  // why: mismo insumo (fossils planos por-oid) que alimenta a la panorámica
  //      y al mini-mapa de estratos — así no divergen colecciones.
  protected readonly flatFossils = computed<readonly FlatFossil[]>(() => {
    const entries = this.entries();
    const byOid = this.milestonesByOid();
    const dayByOid = new Map<string, number>();
    for (const e of entries) dayByOid.set(e.oid, startOfDayMs(e.date.getTime()));
    const flat: FlatFossil[] = [];
    for (const [oid, ms] of byOid) {
      const day = dayByOid.get(oid);
      if (day === undefined) continue;
      for (const m of ms) flat.push({ oid, name: m.name, dayStart: day });
    }
    return flat;
  });

  // ---- Fossil focus (cross-zoom jump) --------------------------------
  // why: click en cualquier fósil (panorámica, estratos, cordel) → aterriza
  //      en cordel con la polaroid enfocada Y con las vecinas filtradas a
  //      ±12h para no ahogar el cordel al saltar entre eras muy pobladas.
  private readonly fossilFocusOidSignal = signal<string | null>(null);
  private readonly fossilFocusNameSignal = signal<string | null>(null);
  private readonly fossilFocusCenterMsSignal = signal<number | null>(null);
  protected readonly fossilFocusOid = this.fossilFocusOidSignal.asReadonly();
  protected readonly fossilFocusName = this.fossilFocusNameSignal.asReadonly();
  protected clearFossilFocus(): void {
    this.fossilFocusOidSignal.set(null);
    this.fossilFocusNameSignal.set(null);
    this.fossilFocusCenterMsSignal.set(null);
  }
  protected jumpToFossil(payload: { oid: string; name: string }): void {
    const entry = this.entries().find((e) => e.oid === payload.oid);
    const center = entry ? entry.date.getTime() : null;
    this.fossilFocusOidSignal.set(payload.oid);
    this.fossilFocusNameSignal.set(payload.name);
    this.fossilFocusCenterMsSignal.set(center);
    this.selectedOidSignal.set(payload.oid);
    this.unlockUpTo('detail');
    this.zoomSignal.set('detail');
    queueMicrotask(() => {
      document
        .getElementById(`polaroid-${payload.oid}`)
        ?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    });
  }

  // Detail (cordel): polaroids en tira horizontal. Un signal separado sigue
  // qué polaroids ya "revelaron" su diff (via HistoryDiffService.loadForCommit).
  // Al entrar al zoom detail, hidratamos las primeras N; el resto se hidrata
  // on-hover/on-scroll para no golpear git con 200 llamadas en paralelo.
  private readonly revealedOidsSignal = signal<ReadonlySet<string>>(new Set());
  private readonly revealingOidsSignal = signal<ReadonlySet<string>>(new Set());
  protected readonly revealedOids = this.revealedOidsSignal.asReadonly();
  protected readonly revealingOids = this.revealingOidsSignal.asReadonly();
  // why: revealPolaroid ya trae el diff completo por commit (para el estado
  //      visual "revelado"); cachearlo acá deja que el preview de hover lo
  //      reuse sin pegarle una segunda vez a git.
  private readonly diffCacheSignal = signal<ReadonlyMap<string, readonly EntityDiff[]>>(new Map());
  protected readonly polaroids = computed<readonly CommitEntry[]>(() => {
    const noise = this.noiseOidsSignal();
    const byOid = this.milestonesByOid();
    const center = this.fossilFocusCenterMsSignal();
    const list = this.entries().filter((e) => byOid.has(e.oid) || !noise.has(e.oid));
    if (center === null) return list;
    // why: ±12h alrededor del fósil — la polaroid focal siempre se garantiza
    //      dentro del rango; ese anchor lo asegura el mismo entry.
    const lo = center - FOSSIL_FOCUS_HALF_MS;
    const hi = center + FOSSIL_FOCUS_HALF_MS;
    return list.filter((e) => {
      const t = e.date.getTime();
      return t >= lo && t <= hi;
    });
  });
  protected revealPolaroid(entry: CommitEntry): void {
    const oid = entry.oid;
    if (this.revealedOidsSignal().has(oid) || this.revealingOidsSignal().has(oid)) return;
    this.revealingOidsSignal.update((s) => new Set(s).add(oid));
    void this.diff
      .loadForCommit(oid)
      .then((diffs) => {
        this.revealedOidsSignal.update((s) => new Set(s).add(oid));
        this.diffCacheSignal.update((m) => new Map(m).set(oid, diffs));
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

  // ---- Preview de diff en hover sostenido (cordel) -----------------------
  // why: click + mesa de revelado cubre el flujo principal; este preview es
  //      pulido opcional para no forzar ese viaje sólo para chusmear qué
  //      tocó un commit. Se apoya en el mismo diffCache que revealPolaroid.
  private hoverPreviewTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly hoverPreviewOidSignal = signal<string | null>(null);
  protected readonly hoverPreview = computed<HoverPreview | null>(() => {
    const oid = this.hoverPreviewOidSignal();
    if (!oid) return null;
    const cached = this.diffCacheSignal().get(oid);
    if (!cached) return { oid, loading: true, summary: EMPTY_DIFF_SUMMARY, topPaths: [] };
    return {
      oid,
      loading: false,
      summary: summarizeDiffs(cached),
      topPaths: cached.slice(0, HOVER_PREVIEW_MAX_PATHS).map((d) => d.filepath),
    };
  });
  protected onPolaroidHoverStart(entry: CommitEntry): void {
    const oid = entry.oid;
    if (this.hoverPreviewTimer) clearTimeout(this.hoverPreviewTimer);
    this.hoverPreviewTimer = setTimeout(() => {
      this.hoverPreviewTimer = null;
      this.hoverPreviewOidSignal.set(oid);
    }, HOVER_PREVIEW_DELAY_MS);
  }
  protected onPolaroidHoverEnd(): void {
    if (this.hoverPreviewTimer) {
      clearTimeout(this.hoverPreviewTimer);
      this.hoverPreviewTimer = null;
    }
    this.hoverPreviewOidSignal.set(null);
  }

  // why: doble-click en un commit (estratos o cordel) baja al cordel con
  //      esa polaroid centrada. Un nivel a la vez.
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

  // why: doble-click en columna de la panorámica baja a estratos y foca el
  //      commit más nuevo de ese día — así el usuario aterriza en rango
  //      exacto. Al bajar desbloqueamos también el paso siguiente (cordel)
  //      porque el target ES una veta concreta, no una elección casual.
  protected onPanoramaColumnActivate(dayStart: number): void {
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

  private readonly selectedOidSignal = signal<string | null>(null);
  protected readonly selectedOid = this.selectedOidSignal.asReadonly();
  protected select(oid: string): void {
    this.selectedOidSignal.set(oid);
  }
  protected readonly selectedEntry = computed<CommitEntry | null>(() => {
    const oid = this.selectedOidSignal();
    if (!oid) return null;
    return this.entries().find((e) => e.oid === oid) ?? null;
  });

  private readonly entityDiffsSignal = signal<readonly EntityDiff[]>([]);
  private readonly diffLoadingSignal = signal(false);
  private readonly expandedPathSignal = signal<string | null>(null);
  protected readonly entityDiffs = this.entityDiffsSignal.asReadonly();
  protected readonly diffLoading = this.diffLoadingSignal.asReadonly();
  protected readonly expandedPath = this.expandedPathSignal.asReadonly();
  protected toggleExpanded(path: string): void {
    this.expandedPathSignal.update((p) => (p === path ? null : path));
  }

  // Summary + group-by-type for the detail pane. Counters from entity status;
  // groups from the path's first segment so the user can scan "what was
  // touched" before drilling into individual files.
  private readonly groupByTypeSignal = signal(false);
  protected readonly groupByType = this.groupByTypeSignal.asReadonly();
  protected toggleGroupByType(): void {
    this.groupByTypeSignal.update((v) => !v);
  }
  protected readonly diffSummary = computed<DiffSummary>(() =>
    summarizeDiffs(this.entityDiffsSignal()),
  );
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

  constructor() {
    // why: al subir a panorámica o entrar a estratos por primera vez tras
    //      cada reloadAll, buscamos el aggregate por día (ambas vistas lo
    //      necesitan). Se cachea hasta el próximo reload.
    effect(() => {
      const z = this.zoomSignal();
      if ((z !== 'panorama' && z !== 'strata') || this.panoramaFetchedForLoad) return;
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

    // ---- Persistence del "rango visible" (Fase 5) -------------------
    // why: cada signal se persiste independientemente para que revisar
    //      el rango al volver sea inmediato y no bloquee el load. El
    //      zoom NUNCA se persiste — el default estratos es una
    //      decisión ergonómica del rediseño.
    effect(() => writeSS(SS_KEY.query, this.query() || null));
    effect(() => writeSS(SS_KEY.facets, JSON.stringify(Array.from(this.enabledFacetsSignal()))));
    effect(() => writeSS(SS_KEY.onlyMile, this.onlyMilestonesSignal() ? '1' : '0'));
    effect(() => writeSS(SS_KEY.selOid, this.selectedOidSignal()));

    // why: reflejar el zoom en la URL para poder compartir la vista
    //      (deep-link). Sin merge, otros query params se perderían.
    effect(() => {
      const z = this.zoomSignal();
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { zoom: ZOOM_INTERNAL_TO_URL[z] },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });
  }

  private unregisterShortcuts: (() => void)[] = [];
  private unregisterTutorials: (() => void)[] = [];

  ngOnInit(): void {
    void this.reloadAll(true);
    // why: +/- cambia el zoom semántico; Esc sube un nivel. Editable-safe
    //      para no colisionar con el buscador ni con inputs de milestone.
    this.unregisterShortcuts.push(
      this.shortcuts.register({
        combo: '+',
        labelKey: 'versioning.history.zoom.shortcutIn',
        scope: 'editable-safe',
        pageScope: 'history',
        handler: () => this.stepZoom(1),
      }),
      this.shortcuts.register({
        combo: '-',
        labelKey: 'versioning.history.zoom.shortcutOut',
        scope: 'editable-safe',
        pageScope: 'history',
        handler: () => this.stepZoom(-1),
      }),
      this.shortcuts.register({
        combo: 'escape',
        labelKey: 'versioning.history.zoom.shortcutUp',
        scope: 'editable-safe',
        pageScope: 'history',
        handler: () => this.stepZoom(-1),
      }),
      // why: '[' / ']' navegan milestone a milestone (o polaroid a polaroid
      //      en cordel) — elegidas por ser estables entre layouts de teclado
      //      y no colisionar con nada dentro del timeline head.
      this.shortcuts.register({
        combo: '[',
        labelKey: 'versioning.history.nav.shortcutPrev',
        scope: 'editable-safe',
        pageScope: 'history',
        handler: () => this.navigateAdjacent(-1),
      }),
      this.shortcuts.register({
        combo: ']',
        labelKey: 'versioning.history.nav.shortcutNext',
        scope: 'editable-safe',
        pageScope: 'history',
        handler: () => this.navigateAdjacent(1),
      }),
    );
    this.unregisterTutorials.push(
      this.tutorials.register(HISTORY_TUTORIAL, { autoStartIfUnseen: true }),
      // why (8.93): flujo manual — solo se arranca desde el picker "Guía
      //      de la página", nunca solo, para no exponer un usuario nuevo
      //      a la restauración antes de que la página tenga sentido.
      this.tutorials.register(HISTORY_RESTORE_TUTORIAL, { autoStartIfUnseen: false }),
    );
  }

  ngOnDestroy(): void {
    this.noiseScanAbort?.abort();
    if (this.hoverPreviewTimer) clearTimeout(this.hoverPreviewTimer);
    for (const fn of this.unregisterShortcuts) fn();
    this.unregisterShortcuts = [];
    for (const fn of this.unregisterTutorials) fn();
    this.unregisterTutorials = [];
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
  protected async reloadAll(selectFirst: boolean): Promise<void> {
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
    //      caller pointed; otherwise fall through to persisted rango
    //      (Fase 5) o al primer commit visible.
    const params = this.route.snapshot.queryParamMap;
    const requested = params.get('oid');
    const matched = requested ? all.find((e) => e.oid === requested) : null;
    if (matched) {
      this.selectedOidSignal.set(matched.oid);
      queueMicrotask(() => {
        document
          .getElementById(`commit-${matched.oid}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    } else if (this.persisted.selectedOid) {
      const prior = all.find((e) => e.oid === this.persisted.selectedOid);
      if (prior) this.selectedOidSignal.set(prior.oid);
      else if (selectFirst && all[0]) this.selectedOidSignal.set(all[0].oid);
    } else if (selectFirst) {
      const first = all[0];
      if (first) this.selectedOidSignal.set(first.oid);
    }
    // why: deep-link `?zoom=` ya se aplicó en el ctor (initialZoomFromUrl).
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

  // Keyboard nav between milestones: '[' previous, ']' next. Bracket-keys are
  // a stable choice across keyboard layouts and don't collide with the inputs
  // inside the timeline head. Registered via ShortcutsService (see ngOnInit).
  private navigateAdjacent(direction: 1 | -1): void {
    // why: en cordel [/] navega polaroid a polaroid (no sólo milestones).
    //      Fósiles siguen destacados visualmente en la tira.
    const target_ =
      this.zoomSignal() === 'detail'
        ? this.findAdjacentCommit(direction)
        : this.findAdjacentMilestone(direction);
    if (!target_) return;
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
}
