// 13b-iii — `/variants` page. UI on top of the safe primitives provided
// by VariantsService (create / rename / delete / setColor / refreshActivity)
// and the switch flow owned by SwitchVariantService. No git logic here.

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { OnInit } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';

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

import { VariantsStatsService } from '../services/variants-stats.service';

interface DeleteRequest {
  readonly variant: Variant;
  readonly unmerged: number;
}

@Component({
  selector: 'mc-variants-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [VariantsStatsService],
  imports: [NgTemplateOutlet, FormsModule, BgColorDirective, McDatePipe],
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
  //      threshold so (a) /settings changes react instantly without
  //      touching git, and (b) the dev panel's "-31d" backdate sticks
  //      until the user explicitly clicks "Releer actividad".
  protected readonly isDormantNow = (v: Variant): boolean =>
    isDormant(v.lastActivityAt, this.thresholdDays(), Date.now());

  protected readonly activeList = computed(() =>
    [...this.file().variants]
      .filter(
        (v) =>
          v.id !== PRINCIPAL_VARIANT_ID &&
          !v.pendingDelete &&
          !isDormant(v.lastActivityAt, this.thresholdDays(), Date.now()),
      )
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt),
  );

  protected readonly dormantList = computed(() =>
    [...this.file().variants]
      .filter(
        (v) =>
          v.id !== PRINCIPAL_VARIANT_ID &&
          !v.pendingDelete &&
          isDormant(v.lastActivityAt, this.thresholdDays(), Date.now()),
      )
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt),
  );

  // Modal state.
  protected readonly showCreate = signal(false);
  protected readonly createName = signal('');
  protected readonly createColor = signal('#7aa2ff');
  protected readonly createFrom = signal(PRINCIPAL_VARIANT_ID);

  protected readonly renamingId = signal<string | null>(null);
  protected readonly renameValue = signal('');

  protected readonly deleteRequest = signal<DeleteRequest | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      await this.variants.refresh();
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

  protected async refreshActivity(): Promise<void> {
    this.refreshing.set(true);
    try {
      await this.variants.refreshActivity(this.thresholdDays());
    } catch (e) {
      this.errors.report(e);
    } finally {
      this.refreshing.set(false);
    }
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
    this.createName.set('');
    this.createColor.set('#7aa2ff');
    this.createFrom.set(this.file().activeId);
    this.showCreate.set(true);
  }

  protected cancelCreate(): void {
    this.showCreate.set(false);
  }

  protected async submitCreate(): Promise<void> {
    const name = this.createName().trim();
    if (!name) return;
    this.busy.set(true);
    try {
      await this.variants.create({
        name,
        color: this.createColor(),
        fromVariantId: this.createFrom(),
      });
      this.showCreate.set(false);
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
    } catch (e) {
      this.errors.report(e);
    } finally {
      this.busy.set(false);
    }
  }
}
