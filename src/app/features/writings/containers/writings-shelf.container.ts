import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AutosaveService } from '@core/autosave/autosave.service';
import { ErrorService } from '@core/errors/error.service';
import { withReauthIfNeeded } from '@core/errors/with-reauth';
import { WorkspaceService } from '@core/fs/workspace.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';
import { TagsService } from '@core/tags/tags.service';
import { IconComponent } from '@shared/icon/icon.component';
import { TagChipComponent } from '@shared/tags/tag-chip.component';

import { NewWritingCardComponent } from '../components/new-writing-card.component';
import { WritingCardComponent } from '../components/writing-card.component';
import type { WritingSummary } from '../models/writing.types';
import { WritingsService } from '../services/writings.service';
import { formatAgo } from './format-ago';

type SortKey = 'updated' | 'title' | 'wordCount';

interface WritingCardView {
  readonly summary: WritingSummary;
  readonly ago: string;
}

const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

@Component({
  selector: 'mc-writings-shelf',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TagChipComponent, WritingCardComponent, NewWritingCardComponent],
  templateUrl: './writings-shelf.container.html',
  styleUrl: './writings-shelf.container.css',
})
export class WritingsShelfContainer {
  private readonly writingsService = inject(WritingsService);
  private readonly tagsService = inject(TagsService);
  private readonly autosave = inject(AutosaveService);
  private readonly workspace = inject(WorkspaceService);
  private readonly router = inject(Router);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);

  protected readonly tags = this.tagsService.tags;
  protected readonly summaries = this.writingsService.summaries;
  protected readonly query = signal<string>('');
  protected readonly activeTagIds = signal<ReadonlySet<string>>(new Set());
  protected readonly sortKey = signal<SortKey>('updated');
  protected readonly creating = signal<boolean>(false);

  protected readonly untitledLabel = computed(() => this.t('writings.untitledTitle'));

  protected readonly availableTags = computed<readonly Tag[]>(() => {
    const used = new Set<string>();
    for (const s of this.summaries()) for (const id of s.tags) used.add(id);
    return this.tags().filter((t) => used.has(t.id));
  });

  protected readonly visible = computed<readonly WritingCardView[]>(() => {
    const q = norm(this.query().trim());
    const tagSet = this.activeTagIds();
    const filtered = this.summaries().filter((w) => {
      if (tagSet.size > 0 && !w.tags.some((id) => tagSet.has(id))) return false;
      if (!q) return true;
      return norm(`${w.title} ${w.preview}`).includes(q);
    });
    const sorted = sortSummaries(filtered, this.sortKey(), this.untitledLabel());
    const tt = (key: TranslationKey, params?: Record<string, string | number>): string =>
      this.i18n.t(key, params);
    return sorted.map((summary) => ({ summary, ago: formatAgo(summary.updatedAt, tt) }));
  });

  protected readonly hasFilter = computed(
    () => this.query().trim() !== '' || this.activeTagIds().size > 0,
  );
  protected readonly empty = computed(() => this.summaries().length === 0 && !this.hasFilter());
  protected readonly noMatch = computed(
    () => this.hasFilter() && this.visible().length === 0 && this.summaries().length > 0,
  );

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onOpen(id: string): void {
    void this.router.navigate(['/writings', id]);
  }

  protected onQueryInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (target) this.query.set(target.value);
  }

  protected onClearQuery(): void {
    this.query.set('');
  }

  protected onToggleTag(id: string): void {
    this.activeTagIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected onClearFilters(): void {
    this.query.set('');
    this.activeTagIds.set(new Set());
  }

  protected isTagActive(id: string): boolean {
    return this.activeTagIds().has(id);
  }

  protected onSortChange(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    if (!target) return;
    const value = target.value;
    if (value === 'updated' || value === 'title' || value === 'wordCount') {
      this.sortKey.set(value);
    }
  }

  protected async onCreate(title: string): Promise<void> {
    if (this.creating()) return;
    this.creating.set(true);
    try {
      await this.workspace.ensureWritable();
      const writing = await this.writingsService.create(title);
      await this.router.navigate(['/writings', writing.id]);
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    } finally {
      this.creating.set(false);
    }
  }

  protected async onDelete(id: string): Promise<void> {
    const summary = this.summaries().find((s) => s.id === id);
    const label = summary?.title || this.untitledLabel();
    if (!confirm(this.t('writings.deleteConfirm').replace('{title}', label))) return;
    try {
      await this.writingsService.deleteToTrash(id);
      await this.autosave.clear(id);
    } catch (e) {
      this.errors.report(e);
    }
  }
}

const sortSummaries = (
  list: readonly WritingSummary[],
  key: SortKey,
  untitled: string,
): readonly WritingSummary[] => {
  const arr = [...list];
  if (key === 'title') {
    arr.sort((a, b) => (a.title || untitled).localeCompare(b.title || untitled));
  } else if (key === 'wordCount') {
    arr.sort((a, b) => b.wordCount - a.wordCount || b.updatedAt.localeCompare(a.updatedAt));
  } else {
    arr.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  return arr;
};
