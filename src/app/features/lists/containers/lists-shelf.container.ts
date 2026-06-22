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

import { ListCardComponent } from '../components/list-card.component';
import { NewListCardComponent } from '../components/new-list-card.component';
import type { ListSummary } from '../models/list.types';
import { ListsService } from '../services/lists.service';

const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

@Component({
  selector: 'mc-lists-shelf',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TagChipComponent, ListCardComponent, NewListCardComponent],
  templateUrl: './lists-shelf.container.html',
  styleUrl: './lists-shelf.container.css',
})
export class ListsShelfContainer {
  private readonly listsService = inject(ListsService);
  private readonly tagsService = inject(TagsService);
  private readonly autosave = inject(AutosaveService);
  private readonly workspace = inject(WorkspaceService);
  private readonly router = inject(Router);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);

  protected readonly tags = this.tagsService.tags;
  protected readonly summaries = this.listsService.summaries;
  protected readonly query = signal<string>('');
  protected readonly activeTagIds = signal<ReadonlySet<string>>(new Set());
  protected readonly creating = signal<boolean>(false);

  protected readonly untitledLabel = computed(() => this.t('lists.untitledTitle'));

  protected readonly availableTags = computed<readonly Tag[]>(() => {
    const used = new Set<string>();
    for (const s of this.summaries()) for (const id of s.tags) used.add(id);
    return this.tags().filter((t) => used.has(t.id));
  });

  protected readonly visible = computed<readonly ListSummary[]>(() => {
    const q = norm(this.query().trim());
    const tagSet = this.activeTagIds();
    return this.summaries().filter((l) => {
      if (tagSet.size > 0 && !l.tags.some((id) => tagSet.has(id))) return false;
      if (!q) return true;
      const haystack = `${l.title} ${l.previewItems.join(' ')}`;
      return norm(haystack).includes(q);
    });
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
    void this.router.navigate(['/lists', id]);
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

  protected async onCreate(title: string): Promise<void> {
    if (this.creating()) return;
    this.creating.set(true);
    try {
      await this.workspace.ensureWritable();
      const list = await this.listsService.create(title);
      await this.router.navigate(['/lists', list.id]);
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    } finally {
      this.creating.set(false);
    }
  }

  protected async onDelete(id: string): Promise<void> {
    const summary = this.summaries().find((s) => s.id === id);
    const label = summary?.title || this.untitledLabel();
    if (!confirm(this.t('lists.deleteConfirm').replace('{title}', label))) return;
    try {
      await this.listsService.deleteToTrash(id);
      await this.autosave.clear(id);
    } catch (e) {
      this.errors.report(e);
    }
  }
}
