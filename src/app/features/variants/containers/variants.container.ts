// 13b-iii — `/variants` page. UI on top of the safe primitives provided
// by VariantsService (create / rename / delete / setColor / refreshActivity)
// and the switch flow owned by SwitchVariantService. No git logic here.
//
// Two-pane layout: VariantsTreeComponent on the left (hierarchical list
// + search + create CTA), VariantDetailComponent on the right (full
// detail of the selected variant + actions). Selection auto-syncs to
// the active variant on first load and after any switch.

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import type { OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { ErrorService } from '@core/errors/error.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { SettingsService } from '@core/settings/settings.service';
import { SwitchVariantService } from '@core/versioning/switch-variant.service';
import { isDormant } from '@core/versioning/variants-activity';
import { VariantsService } from '@core/versioning/variants.service';
import { PRINCIPAL_VARIANT_ID, type Variant } from '@core/versioning/variants.types';

import { VariantDetailComponent } from '../components/variant-detail.component';
import {
  VariantsCreateModalComponent,
  type CreateVariantRequest,
} from '../components/variants-create-modal.component';
import { VariantsTreeComponent } from '../components/variants-tree.component';
import { VariantsStatsService, type VariantOverview } from '../services/variants-stats.service';
import { buildVariantTree } from '../utils/variant-tree';

interface DeleteRequest {
  readonly variant: Variant;
  readonly unmerged: number;
}

@Component({
  selector: 'mc-variants-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [VariantsStatsService],
  imports: [VariantsTreeComponent, VariantDetailComponent, VariantsCreateModalComponent],
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

  protected readonly thresholdDays = computed(
    () => this.settings.state().variants.dormantThresholdDays,
  );

  protected readonly visibleVariants = computed(() =>
    this.file().variants.filter((v) => !v.pendingDelete),
  );

  protected readonly tree = computed(() => buildVariantTree(this.visibleVariants()));

  protected readonly dormantIds = computed<ReadonlySet<string>>(() => {
    const now = Date.now();
    const days = this.thresholdDays();
    const out = new Set<string>();
    for (const v of this.visibleVariants()) {
      if (v.id === PRINCIPAL_VARIANT_ID) continue;
      if (isDormant(v.lastActivityAt, days, now)) out.add(v.id);
    }
    return out;
  });

  protected readonly query = signal('');
  protected readonly renamingId = signal<string | null>(null);
  protected readonly renameValue = signal('');
  protected readonly deleteRequest = signal<DeleteRequest | null>(null);
  protected readonly overviews = signal<Record<string, VariantOverview>>({});
  protected readonly showCreate = signal(false);
  protected readonly selectedId = signal<string | null>(null);

  protected readonly selected = computed<Variant | null>(() => {
    const id = this.selectedId();
    if (!id) return null;
    return this.visibleVariants().find((v) => v.id === id) ?? null;
  });

  protected readonly selectedOverview = computed<VariantOverview | null>(() => {
    const id = this.selectedId();
    if (!id) return null;
    return this.overviews()[id] ?? null;
  });

  protected readonly selectedParentName = computed<string | null>(() => {
    const v = this.selected();
    if (!v?.parentId) return null;
    return this.visibleVariants().find((p) => p.id === v.parentId)?.name ?? null;
  });

  private lastActiveId = '';

  constructor() {
    // why: keep selection pinned to the active variant on first load and
    //      after every switch. Manual clicks in the tree override until
    //      the next switch flips activeId again.
    effect(() => {
      const aid = this.file().activeId;
      if (aid && aid !== this.lastActiveId) {
        this.lastActiveId = aid;
        this.selectedId.set(aid);
      }
    });
  }

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

  protected isActive(v: Variant | null): boolean {
    return !!v && this.file().activeId === v.id;
  }

  protected isDormantNow(v: Variant | null): boolean {
    return !!v && this.dormantIds().has(v.id);
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

  protected onSelect(id: string): void {
    this.selectedId.set(id);
    if (this.renamingId() && this.renamingId() !== id) this.renamingId.set(null);
  }

  protected onOpenCommit(oid: string): void {
    void this.router.navigate(['/history'], { queryParams: { oid } });
  }

  protected async onSwitch(): Promise<void> {
    const v = this.selected();
    if (!v || this.isActive(v) || this.switching()) return;
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

  protected startRename(): void {
    const v = this.selected();
    if (!v) return;
    this.renamingId.set(v.id);
    this.renameValue.set(v.name);
  }

  protected cancelRename(): void {
    this.renamingId.set(null);
  }

  protected async submitRename(): Promise<void> {
    const v = this.selected();
    if (!v) return;
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

  protected onColorChange(color: string): void {
    const v = this.selected();
    if (!v || color === v.color) return;
    void this.variants.setColor(v.id, color).catch((e) => this.errors.report(e));
  }

  protected onMerge(): void {
    const v = this.selected();
    if (!v || v.protected) return;
    void this.router.navigate(['/variants/merge'], {
      queryParams: { from: v.id, into: PRINCIPAL_VARIANT_ID },
    });
  }

  protected async requestDelete(): Promise<void> {
    const v = this.selected();
    if (!v || this.isActive(v)) return;
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
