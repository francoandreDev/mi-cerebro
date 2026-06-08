import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { ErrorService } from '@core/errors/error.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { TrashService } from '@core/trash/trash.service';
import type { TrashEntry } from '@core/trash/trash.types';

@Component({
  selector: 'mc-trash',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trash.container.html',
  styleUrl: './trash.container.css',
})
export class TrashContainer {
  private readonly trash = inject(TrashService);
  private readonly i18n = inject(I18nService);
  private readonly errors = inject(ErrorService);

  protected readonly entries = this.trash.entries;
  protected readonly isEmpty = computed(() => this.entries().length === 0);

  constructor() {
    void this.trash.refresh().catch((e: unknown) => this.errors.report(e));
  }

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected kindLabel(entry: TrashEntry): string {
    return this.t(`trash.kind.${entry.kind}` as TranslationKey);
  }

  protected async restore(entry: TrashEntry): Promise<void> {
    try {
      await this.trash.restore(entry);
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected async purge(entry: TrashEntry): Promise<void> {
    const label = entry.title || this.t('trash.untitledTitle');
    if (!confirm(this.t('trash.purgeConfirm').replace('{title}', label))) return;
    try {
      await this.trash.purge(entry);
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected async empty(): Promise<void> {
    if (!confirm(this.t('trash.emptyConfirm'))) return;
    try {
      await this.trash.empty();
    } catch (e) {
      this.errors.report(e);
    }
  }
}
