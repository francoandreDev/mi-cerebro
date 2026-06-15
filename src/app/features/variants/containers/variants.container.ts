// 13b-iii — `/variants` page. UI on top of the safe primitives provided
// by VariantsService (create / rename / delete / setColor / refreshActivity)
// and the switch flow owned by SwitchVariantService. No git logic here.

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { OnInit } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { ErrorService } from '@core/errors/error.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { SettingsService } from '@core/settings/settings.service';
import { SwitchVariantService } from '@core/versioning/switch-variant.service';
import { isDormant } from '@core/versioning/variants-activity';
import { VariantsService } from '@core/versioning/variants.service';
import { PRINCIPAL_VARIANT_ID, type Variant } from '@core/versioning/variants.types';
import { BgColorDirective } from '@shared/directives/bg-color.directive';
import { McDatePipe } from '@shared/pipes/mc-date.pipe';

import {
  VariantsCreateModalComponent,
  type CreateVariantRequest,
} from '../components/variants-create-modal.component';
import {
  VariantsFiltersComponent,
  type StateFilter,
} from '../components/variants-filters.component';
import {
  VariantsOverviewGraphComponent,
  type LaneActionRequest,
} from '../components/variants-overview-graph.component';
import { VariantsStatsService, type VariantOverview } from '../services/variants-stats.service';

interface DeleteRequest {
  readonly variant: Variant;
  readonly unmerged: number;
}

@Component({
  selector: 'mc-variants-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [VariantsStatsService],
  imports: [
    NgTemplateOutlet,
    FormsModule,
    BgColorDirective,
    McDatePipe,
    VariantsOverviewGraphComponent,
    VariantsFiltersComponent,
    VariantsCreateModalComponent,
  ],
  templateUrl: './variants.container.html',
  styleUrl: './variants.container.css',
})
export class VariantsContainer implements OnInit {
  private readonly variants = inject(VariantsService);
  private readonly switcher = inject(SwitchVariantService);
  private readonly stats = inject(VariantsStatsService);
  private readonly settings = inject(SettingsService);
  private readonly i18n = inject(I18nService);
  private readonly errors = inject(ErrorService);
  private readonly router = inject(Router);

  protected readonly file = this.variants.file;
  protected readonly switching = this.switcher.switching;
  protected readonly busy = signal(false);
  protected readonly refreshing = signal(false);

  protected readonly principal = computed(
    () => this.file().variants.find((v) => v.id === PRINCIPAL_VARIANT_ID) ?? null,
  );

  protected readonly thresholdDays = computed(
    () => this.settings.state().variants.dormantThresholdDays,
  );

  // why: compute dormant state live from `lastActivityAt` + the current
  //      threshold so /settings changes react instantly and the dev
  //      panel's backdate sticks until "Releer actividad".
  protected readonly isDormantNow = (v: Variant): boolean =>
    isDormant(v.lastActivityAt, this.thresholdDays(), Date.now());

  protected readonly renamingId = signal<string | null>(null);
  protected readonly renameValue = signal('');
  protected readonly deleteRequest = signal<DeleteRequest | null>(null);
  protected readonly overviews = signal<Record<string, VariantOverview>>({});
  protected readonly showCreate = signal(false);
  protected readonly highlightedId = signal<string | null>(null);

  protected readonly query = signal('');
  protected readonly stateFilter = signal<StateFilter>('all');
  protected readonly parentFilter = signal<string>('all');

  protected readonly visibleVariants = computed(() =>
    this.file().variants.filter((v) => !v.pendingDelete),
  );

  protected readonly variantNameById = computed(() => {
    const out: Record<string, string> = {};
    for (const v of this.file().variants) out[v.id] = v.name;
    return out;
  });

  // Parents available in the "Forkeado desde" filter: anything that
  // could be a parent (Principal + every existing variant).
  protected readonly parentsForFilter = computed(() => this.visibleVariants());

  protected readonly hasActiveFilter = computed(
    () =>
      this.query().trim() !== '' || this.stateFilter() !== 'all' || this.parentFilter() !== 'all',
  );

  private readonly matchesFilter = (v: Variant): boolean => {
    const sf = this.stateFilter();
    if (sf === 'principal' && v.id !== PRINCIPAL_VARIANT_ID) return false;
    if (sf === 'active' && (v.id === PRINCIPAL_VARIANT_ID || this.isDormantNow(v))) return false;
    if (sf === 'dormant' && (v.id === PRINCIPAL_VARIANT_ID || !this.isDormantNow(v))) return false;

    const pf = this.parentFilter();
    if (pf !== 'all' && v.parentId !== pf) return false;

    const q = this.query().trim().toLowerCase();
    if (!q) return true;
    const ov = this.overviews()[v.id] ?? null;
    const parentName = v.parentId ? (this.variantNameById()[v.parentId] ?? '') : '';
    const hay = [
      v.name,
      v.id,
      parentName,
      v.forkOid ?? '',
      ov?.head?.subject ?? '',
      ov?.head?.oid ?? '',
      ov?.milestone?.name ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  };

  protected readonly filteredCount = computed(
    () => this.visibleVariants().filter((v) => this.matchesFilter(v)).length,
  );

  protected readonly activeList = computed(() =>
    [...this.visibleVariants()]
      .filter((v) => v.id !== PRINCIPAL_VARIANT_ID && !this.isDormantNow(v))
      .filter((v) => this.matchesFilter(v))
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt),
  );

  protected readonly dormantList = computed(() =>
    [...this.visibleVariants()]
      .filter((v) => v.id !== PRINCIPAL_VARIANT_ID && this.isDormantNow(v))
      .filter((v) => this.matchesFilter(v))
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt),
  );

  protected readonly principalVisible = computed(() => {
    const p = this.principal();
    return p && this.matchesFilter(p) ? p : null;
  });

  async ngOnInit(): Promise<void> {
    try {
      await this.variants.refresh();
      await this.loadOverviews();
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  protected isActive(v: Variant): boolean {
    return this.file().activeId === v.id;
  }

  protected shortOid(oid: string | null | undefined): string {
    return oid ? oid.slice(0, 7) : '';
  }

  protected clearFilters(): void {
    this.query.set('');
    this.stateFilter.set('all');
    this.parentFilter.set('all');
  }

  protected async refreshActivity(): Promise<void> {
    this.refreshing.set(true);
    try {
      await this.variants.refreshActivity(this.thresholdDays());
      this.stats.invalidate();
      await this.loadOverviews();
    } catch (e) {
      this.errors.report(e);
    } finally {
      this.refreshing.set(false);
    }
  }

  private async loadOverviews(): Promise<void> {
    const list = this.visibleVariants();
    const entries = await Promise.all(
      list.map(async (v) => [v.id, await this.stats.overview(v)] as const),
    );
    const next: Record<string, VariantOverview> = {};
    for (const [id, ov] of entries) next[id] = ov;
    this.overviews.set(next);
  }

  protected onGraphHover(id: string | null): void {
    this.highlightedId.set(id);
    if (!id) return;
    queueMicrotask(() => {
      const el = document.getElementById(`variant-card-${id}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  protected onGraphAction(req: LaneActionRequest): void {
    const v = this.visibleVariants().find((x) => x.id === req.id);
    if (!v) return;
    switch (req.kind) {
      case 'switch':
        void this.onSwitch(v);
        return;
      case 'rename':
        this.startRename(v);
        return;
      case 'merge':
        this.onMerge(v);
        return;
      case 'delete':
        void this.requestDelete(v);
        return;
    }
  }

  protected onOpenCommit(oid: string): void {
    void this.router.navigate(['/history'], { queryParams: { oid } });
  }

  protected async onSwitch(v: Variant): Promise<void> {
    if (this.isActive(v) || this.switching()) return;
    try {
      await this.switcher.switchTo(v.id);
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected openCreate(): void {
    this.showCreate.set(true);
  }

  protected cancelCreate(): void {
    this.showCreate.set(false);
  }

  protected async submitCreate(req: CreateVariantRequest): Promise<void> {
    this.busy.set(true);
    try {
      await this.variants.create(req);
      this.showCreate.set(false);
      await this.loadOverviews();
    } catch (e) {
      this.errors.report(e);
    } finally {
      this.busy.set(false);
    }
  }

  protected startRename(v: Variant): void {
    this.renamingId.set(v.id);
    this.renameValue.set(v.name);
  }

  protected cancelRename(): void {
    this.renamingId.set(null);
  }

  protected async submitRename(v: Variant): Promise<void> {
    const next = this.renameValue().trim();
    if (!next || next === v.name) {
      this.renamingId.set(null);
      return;
    }
    this.busy.set(true);
    try {
      await this.variants.rename(v.id, next);
      this.renamingId.set(null);
    } catch (e) {
      this.errors.report(e);
    } finally {
      this.busy.set(false);
    }
  }

  protected onColorInput(v: Variant, event: Event): void {
    const color = (event.target as HTMLInputElement).value;
    if (color === v.color) return;
    void this.variants.setColor(v.id, color).catch((e) => this.errors.report(e));
  }

  protected onMerge(v: Variant): void {
    if (v.protected) return;
    void this.router.navigate(['/variants/merge'], {
      queryParams: { from: v.id, into: PRINCIPAL_VARIANT_ID },
    });
  }

  protected async requestDelete(v: Variant): Promise<void> {
    if (this.isActive(v)) return;
    this.busy.set(true);
    try {
      const unmerged = await this.stats.unmergedAgainstPrincipal(v);
      this.deleteRequest.set({ variant: v, unmerged });
    } finally {
      this.busy.set(false);
    }
  }

  protected cancelDelete(): void {
    this.deleteRequest.set(null);
  }

  protected async confirmDelete(): Promise<void> {
    const req = this.deleteRequest();
    if (!req) return;
    this.busy.set(true);
    try {
      await this.variants.delete(req.variant.id);
      this.deleteRequest.set(null);
      this.stats.invalidate();
      await this.loadOverviews();
    } catch (e) {
      this.errors.report(e);
    } finally {
      this.busy.set(false);
    }
  }
}
