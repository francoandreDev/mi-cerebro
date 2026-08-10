import type { OnDestroy, OnInit } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { ErrorService } from '@core/errors/error.service';
import { I18nService } from '@core/i18n/i18n.service';
import { SettingsService } from '@core/settings/settings.service';
import { CompactionSchedulerService } from '@core/versioning/compaction-scheduler.service';
import type { Variant } from '@core/versioning/variants.types';
import { ConfirmController } from '@shared/confirm-dialog/confirm-controller';
import { ConfirmDialogComponent } from '@shared/confirm-dialog/confirm-dialog.component';
import { IconComponent } from '@shared/icon/icon.component';
import { McDatePipe } from '@shared/pipes/mc-date.pipe';

import { BUCKET_LABEL_KEY } from '../services/bucket-labels';
import { commitOriginColor, commitOriginName } from '../services/commit-origin';
import { facetOf, type Facet } from '../services/facet';
import type { DayAggregate } from '../services/history-loader.service';
import type { BucketId, CommitEntry, MilestoneEntry } from '../services/history.types';
import { computePanoramaGeometry, panoramaFossils, startOfDayMs } from '../services/strata.utils';
import type { PanoramaGeometry, PanoramaFossil, StratumDensity } from '../services/strata.utils';
import type { Stratum } from '../containers/history.container';
import type { FlatFossil } from './history-panorama.component';

@Component({
  selector: 'mc-history-strata',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ConfirmDialogComponent, IconComponent, McDatePipe, RouterLink],
  templateUrl: './history-strata.component.html',
  styleUrls: ['./history-strata.component.css', './history-strata.component.mobile.css'],
})
export class HistoryStrataComponent implements OnInit, OnDestroy {
  protected readonly i18n = inject(I18nService);
  private readonly errors = inject(ErrorService);
  private readonly settings = inject(SettingsService);
  private readonly compactionScheduler = inject(CompactionSchedulerService);
  private readonly hostRef: ElementRef<HTMLElement> = inject(ElementRef);

  readonly strata = input.required<readonly Stratum[]>();
  readonly selectedOid = input.required<string | null>();
  readonly headOid = input.required<string | null>();
  readonly entries = input.required<readonly CommitEntry[]>();
  readonly aggregates = input.required<readonly DayAggregate[]>();
  readonly flatFossils = input.required<readonly FlatFossil[]>();
  readonly originByOid = input.required<ReadonlyMap<string, string>>();
  readonly variantsById = input.required<ReadonlyMap<string, Variant>>();
  readonly milestonesByOid = input.required<ReadonlyMap<string, readonly MilestoneEntry[]>>();
  readonly allFacets = input.required<readonly Facet[]>();
  readonly query = input.required<string>();
  readonly enabledFacets = input.required<ReadonlySet<Facet>>();
  readonly onlyMilestones = input.required<boolean>();
  readonly loading = input.required<boolean>();
  readonly error = input.required<string | null>();
  readonly noResults = input.required<boolean>();

  readonly selectCommit = output<string>();
  readonly activateCommit = output<string>();
  readonly jumpToFossilEv = output<{ oid: string; name: string }>();
  readonly zoomBack = output<void>();
  readonly queryChange = output<string>();
  readonly clearQuery = output<void>();
  readonly toggleFacet = output<Facet>();
  readonly toggleOnlyMilestones = output<void>();

  protected readonly suggestEnableCompaction =
    this.compactionScheduler.shouldSuggestEnableCompaction;
  protected readonly compactionConfirm = new ConfirmController();
  protected readonly compacting = signal(false);

  // why: §12 "Compactación manual sobre rango específico" — unlike
  //      onCompactNow (whole workspace, age-bucketed), this lets the user
  //      pick an explicit [from, to] date window; every non-barrier commit
  //      inside it fuses into one commit per ref regardless of the 7-day
  //      recency floor. Same confirm/compacting machinery as the banner.
  protected readonly rangePanelOpen = signal(false);
  protected readonly rangeFrom = signal('');
  protected readonly rangeTo = signal('');
  protected readonly rangeValid = computed(() => {
    const from = this.rangeFrom();
    const to = this.rangeTo();
    return from !== '' && to !== '' && from <= to;
  });

  protected toggleRangePanel(): void {
    this.rangePanelOpen.update((v) => !v);
  }

  protected onRangeFromInput(ev: Event): void {
    this.rangeFrom.set((ev.target as HTMLInputElement).value);
  }

  protected onRangeToInput(ev: Event): void {
    this.rangeTo.set((ev.target as HTMLInputElement).value);
  }

  protected onCompactRange(): void {
    if (!this.rangeValid()) return;
    const from = this.rangeFrom();
    const to = this.rangeTo();
    const fromMs = new Date(`${from}T00:00:00`).getTime();
    const toMs = new Date(`${to}T23:59:59.999`).getTime();
    this.compactionConfirm.ask(
      {
        title: this.i18n.t('versioning.history.rangeCompaction.confirm.title'),
        message: this.i18n.t('versioning.history.rangeCompaction.confirm.body', { from, to }),
        confirmLabel: this.i18n.t('versioning.history.rangeCompaction.confirm.confirm'),
        cancelLabel: this.i18n.t('versioning.history.rangeCompaction.confirm.cancel'),
        tone: 'default',
      },
      async () => {
        this.compacting.set(true);
        try {
          await this.compactionScheduler.runOnce({ range: { fromMs, toMs } });
          this.rangePanelOpen.set(false);
        } catch (e) {
          this.errors.report(e);
        } finally {
          this.compacting.set(false);
        }
      },
    );
  }

  protected isFacetEnabled(f: Facet): boolean {
    return this.enabledFacets().has(f);
  }

  protected onQueryInput(ev: Event): void {
    this.queryChange.emit((ev.target as HTMLInputElement).value);
  }

  protected facetLabelKey(f: Facet): `versioning.history.facet.${Facet}` {
    return `versioning.history.facet.${f}`;
  }

  protected facetOfMessage(message: string): Facet {
    return facetOf(message);
  }

  protected commitOriginColor(oid: string): string | null {
    return commitOriginColor(oid, this.originByOid(), this.variantsById());
  }
  protected commitOriginName(oid: string): string | null {
    return commitOriginName(oid, this.originByOid(), this.variantsById());
  }

  protected milestonesFor(oid: string): readonly MilestoneEntry[] {
    return this.milestonesByOid().get(oid) ?? [];
  }

  protected onFossilClick(oid: string, name: string): void {
    this.jumpToFossilEv.emit({ oid, name });
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

  ngOnInit(): void {
    this.rebindStratumObserver();
  }

  ngOnDestroy(): void {
    this.stratumObserver?.disconnect();
    this.stratumObserver = null;
  }

  protected rebindStratumObserver(): void {
    const host = this.hostRef.nativeElement;
    if (!('IntersectionObserver' in window)) {
      // why: sin observer soportado, hidratamos todo — degradación honesta.
      this.hydratedBucketsSignal.set(new Set(this.strata().map((s) => s.id)));
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

  // why: la "roca" del estrato usa la escala log del thicknessPx (20–96)
  // pero pide más aire vertical para que las tres franjas se distingan
  // — mapeamos 20→40 y 96→140. Empíricamente, por debajo de 40px las
  // franjas se aplastan y no se leen como sedimento.
  protected stratumRockHeightPx(d: StratumDensity): number {
    const t = d.thicknessPx;
    return Math.round(40 + ((t - 20) / (96 - 20)) * 100);
  }

  protected bucketLabel(id: BucketId): string {
    return this.i18n.t(BUCKET_LABEL_KEY[id]);
  }

  // ---- Minimapa (comparte el mismo aggregate que la panorámica) --------
  private readonly MINIMAP_HEIGHT = 56;
  protected readonly minimapGeometry = computed<PanoramaGeometry>(() =>
    computePanoramaGeometry(this.aggregates(), { height: this.MINIMAP_HEIGHT }),
  );
  protected readonly minimapFossils = computed<readonly PanoramaFossil[]>(() =>
    panoramaFossils(this.minimapGeometry(), this.flatFossils()),
  );
  protected readonly minimapWindow = signal<{ x: number; width: number } | null>(null);

  protected onTimelineScroll(ev: Event): void {
    const el = ev.currentTarget as HTMLElement;
    const geo = this.minimapGeometry();
    if (geo.columns.length === 0 || geo.width === 0) {
      this.minimapWindow.set(null);
      return;
    }
    const total = Math.max(1, el.scrollHeight - el.clientHeight);
    const from = el.scrollTop / total;
    const to = (el.scrollTop + el.clientHeight) / total;
    const x = from * geo.width;
    const width = Math.max(4, (to - from) * geo.width);
    this.minimapWindow.set({ x, width });
  }

  protected onMinimapColumnClick(dayStart: number): void {
    // why: mini-mapa navega DENTRO del yacimiento — busca el bucket cuyo
    //      rango contiene el commit del día tocado y scrollea a él. Si el
    //      día tiene fósil, saltamos al detalle honrando la metáfora
    //      cross-zoom (llegás con la lupa puesta).
    const entry = this.entries().find((e) => startOfDayMs(e.date.getTime()) === dayStart);
    if (!entry) return;
    const fossil = this.milestonesByOid().get(entry.oid);
    if (fossil && fossil.length > 0) {
      this.jumpToFossilEv.emit({ oid: entry.oid, name: fossil[0]!.name });
      return;
    }
    this.selectCommit.emit(entry.oid);
  }

  // ---- Ficha de yacimiento (detail pane) --------------------------------
  protected readonly selectedStratum = computed<Stratum | null>(() => {
    const list = this.strata();
    const oid = this.selectedOid();
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
      this.hostRef.nativeElement
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

  // why: the banner only shows when compaction is remote-gated
  //      (`shouldSuggestEnableCompaction` — remote configured, "compactar
  //      con remoto" off). `decideCompaction` skips remote-gated refs
  //      unconditionally, `ignoreThreshold` does NOT bypass that gate — so
  //      just calling `runOnce` here would silently no-op in exactly the
  //      case this button is shown for. The real action is the one the old
  //      "ir a configuración" link pointed at: turn the setting on, then run.
  //      Rewrites git history (and force-pushes if a remote is configured),
  //      so it's gated behind a real confirm, same as the /dev QA button.
  protected onCompactNow(): void {
    this.compactionConfirm.ask(
      {
        title: this.i18n.t('versioning.history.compactionBanner.confirm.title'),
        message: this.i18n.t('versioning.history.compactionBanner.confirm.body'),
        confirmLabel: this.i18n.t('versioning.history.compactionBanner.confirm.confirm'),
        cancelLabel: this.i18n.t('versioning.history.compactionBanner.confirm.cancel'),
        tone: 'default',
      },
      async () => {
        this.compacting.set(true);
        try {
          this.settings.setCompactWithRemote(true);
          await this.compactionScheduler.runOnce({ ignoreThreshold: true });
        } catch (e) {
          this.errors.report(e);
        } finally {
          this.compacting.set(false);
        }
      },
    );
  }
}
