// 13b-iii — `/variants` page. UI on top of the safe primitives provided
// by VariantsService (create / rename / delete / setColor / refreshActivity)
// and the switch flow owned by SwitchVariantService. No git logic here.
//
// Full-canvas delta view: VariantsDeltaComponent renders every family
// as a channel in an SVG river; VariantDrawerComponent slides under it
// with the selected variant's compact detail + actions. Selection
// auto-syncs to the active variant on first load and after any switch.

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import type { OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { ErrorService } from '@core/errors/error.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { SettingsService } from '@core/settings/settings.service';
import { SwitchVariantService } from '@core/versioning/switch-variant.service';
import { isDormant } from '@core/versioning/variants-activity';
import { VariantsService } from '@core/versioning/variants.service';
import { PRINCIPAL_VARIANT_ID, type Variant } from '@core/versioning/variants.types';

import { ConfirmController } from '@shared/confirm-dialog/confirm-controller';
import { ConfirmDialogComponent } from '@shared/confirm-dialog/confirm-dialog.component';
import { IconComponent } from '@shared/icon/icon.component';

import { VariantDrawerComponent } from '../components/variant-drawer.component';
import { VariantsDeltaComponent } from '../components/variants-delta.component';
import {
  VariantsCreateModalComponent,
  type CreateVariantRequest,
} from '../components/variants-create-modal.component';
import { VariantsStatsService, type VariantOverview } from '../services/variants-stats.service';
import { registerVariantsTutorial } from './variants.tutorial';

@Component({
  selector: 'mc-variants-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [VariantsStatsService],
  imports: [
    FormsModule,
    VariantsDeltaComponent,
    VariantDrawerComponent,
    VariantsCreateModalComponent,
    IconComponent,
    ConfirmDialogComponent,
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
  private readonly route = inject(ActivatedRoute);

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
  protected readonly confirm = new ConfirmController();
  protected readonly overviews = signal<Record<string, VariantOverview>>({});
  protected readonly showCreate = signal(false);
  protected readonly selectedId = signal<string | null>(null);
  // why: set from ?justMerged=<id> on arrival from /variants/merge so
  //      the delta can play the confluence animation once. Cleared on a
  //      timer after the animation ends; URL param is stripped on read.
  protected readonly justMergedId = signal<string | null>(null);
  private mergedClearTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly showLegend = signal(false);

  protected toggleLegend(): void {
    this.showLegend.update((v) => !v);
  }

  protected closeLegend(): void {
    this.showLegend.set(false);
  }

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
    registerVariantsTutorial();
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
      this.pickupJustMerged();
    } catch (e) {
      this.errors.report(e);
    }
  }

  private pickupJustMerged(): void {
    const raw = this.route.snapshot.queryParamMap.get('justMerged');
    if (!raw) return;
    const id = raw.trim();
    const exists = this.visibleVariants().some((v) => v.id === id);
    if (!exists) return;
    this.justMergedId.set(id);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { justMerged: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    if (this.mergedClearTimer) clearTimeout(this.mergedClearTimer);
    this.mergedClearTimer = setTimeout(() => {
      this.justMergedId.set(null);
      this.mergedClearTimer = null;
    }, 1800);
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
    let unmerged: number;
    try {
      unmerged = await this.stats.unmergedAgainstPrincipal(v);
    } finally {
      this.busy.set(false);
    }
    const message =
      unmerged > 0
        ? `${this.t('variants.delete.confirm', { name: v.name })} ${this.t('variants.delete.unmerged.warning', { n: unmerged })}`
        : this.t('variants.delete.confirm', { name: v.name });
    this.confirm.ask(
      {
        title: this.t('variants.action.delete'),
        message,
        confirmLabel: this.t('variants.delete.confirm.button'),
        cancelLabel: this.t('variants.form.cancel'),
        tone: 'danger',
      },
      async () => {
        this.busy.set(true);
        try {
          await this.variants.delete(v.id);
          this.stats.invalidate();
          await this.loadOverviews();
        } catch (e) {
          this.errors.report(e);
        } finally {
          this.busy.set(false);
        }
      },
    );
  }
}
