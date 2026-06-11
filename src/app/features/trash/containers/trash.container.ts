import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ErrorService } from '@core/errors/error.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { TrashService } from '@core/trash/trash.service';
import type { TrashEntry, TrashPreview } from '@core/trash/trash.types';
import { McDatePipe } from '@shared/pipes/mc-date.pipe';

type PreviewState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly preview: TrashPreview }
  | { readonly status: 'missing' };

@Component({
  selector: 'mc-trash',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [McDatePipe],
  templateUrl: './trash.container.html',
  styleUrl: './trash.container.css',
})
export class TrashContainer {
  private readonly trash = inject(TrashService);
  private readonly i18n = inject(I18nService);
  private readonly errors = inject(ErrorService);

  protected readonly entries = this.trash.entries;
  protected readonly isEmpty = computed(() => this.entries().length === 0);

  private readonly expandedKey = signal<string | null>(null);
  private readonly previewCache = signal<ReadonlyMap<string, PreviewState>>(new Map());

  constructor() {
    void this.trash.refresh().catch((e: unknown) => this.errors.report(e));
  }

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected kindLabel(entry: TrashEntry): string {
    return this.t(`trash.kind.${entry.kind}` as TranslationKey);
  }

  protected entryKey(entry: TrashEntry): string {
    return `${entry.parentPath.join('/')}/${entry.filename}`;
  }

  protected isExpanded(entry: TrashEntry): boolean {
    return this.expandedKey() === this.entryKey(entry);
  }

  protected previewState(entry: TrashEntry): PreviewState | null {
    return this.previewCache().get(this.entryKey(entry)) ?? null;
  }

  protected async toggle(entry: TrashEntry): Promise<void> {
    const key = this.entryKey(entry);
    if (this.expandedKey() === key) {
      this.expandedKey.set(null);
      return;
    }
    this.expandedKey.set(key);
    if (this.previewCache().has(key)) return;
    this.setPreview(key, { status: 'loading' });
    try {
      const preview = await this.trash.loadPreview(entry);
      this.setPreview(key, preview ? { status: 'ready', preview } : { status: 'missing' });
    } catch (e) {
      this.errors.report(e);
      this.setPreview(key, { status: 'missing' });
    }
  }

  private setPreview(key: string, state: PreviewState): void {
    this.previewCache.update((m) => {
      const next = new Map(m);
      next.set(key, state);
      return next;
    });
  }

  protected factLabel(labelKey: string): string {
    return this.t(labelKey as TranslationKey);
  }

  protected factValue(value: string): string {
    // why: status fact values are translation keys, not display strings,
    //      so they can adapt to the active locale.
    if (value.startsWith('trash.preview.status.')) return this.t(value as TranslationKey);
    return value;
  }

  protected async restore(entry: TrashEntry, event: Event): Promise<void> {
    event.stopPropagation();
    try {
      await this.trash.restore(entry);
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected async purge(entry: TrashEntry, event: Event): Promise<void> {
    event.stopPropagation();
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
