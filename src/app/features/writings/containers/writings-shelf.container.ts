import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { AutosaveService } from '@core/autosave/autosave.service';
import { ErrorService } from '@core/errors/error.service';
import { withReauthIfNeeded } from '@core/errors/with-reauth';
import { handleCreateFolder, openFolderActionDialog } from '@core/folders/folder-crud';
import { FoldersService } from '@core/folders/folders.service';
import { WorkspaceService } from '@core/fs/workspace.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { entitySlugSegment } from '@core/routing/entity-slug';
import type { Tag } from '@core/tags/tag.types';
import { TagsService } from '@core/tags/tags.service';
import { ConfirmController } from '@shared/confirm-dialog/confirm-controller';
import { ConfirmDialogComponent } from '@shared/confirm-dialog/confirm-dialog.component';
import { FolderActionDialogComponent } from '@shared/folder-action-dialog/folder-action-dialog.component';
import { FolderActionDialogController } from '@shared/folder-action-dialog/folder-action-dialog.controller';
import { FolderBreadcrumbComponent } from '@shared/folder-breadcrumb/folder-breadcrumb.component';
import { IconComponent } from '@shared/icon/icon.component';
import { TagChipComponent } from '@shared/tags/tag-chip.component';

import { ContinueReadingCardComponent } from '../components/continue-reading-card.component';
import { NewWritingCardComponent } from '../components/new-writing-card.component';
import { WritingCardComponent } from '../components/writing-card.component';
import { WritingRowComponent } from '../components/writing-row.component';
import { WritingSpineComponent } from '../components/writing-spine.component';
import type { WritingSummary } from '../models/writing.types';
import { WritingsService } from '../services/writings.service';
import { formatAgo } from './format-ago';

type SortKey = 'updated' | 'title' | 'wordCount';
type ViewMode = 'shelf' | 'table' | 'list';

const VIEW_MODE_STORAGE_KEY = 'mc:writings:viewMode';
const GROUPING_STORAGE_KEY = 'mc:writings:grouping';
const UNTITLED_GROUP_KEY = '__untitled__';
const isViewMode = (v: string | null): v is ViewMode =>
  v === 'shelf' || v === 'table' || v === 'list';

interface DisplayGroup {
  readonly key: string;
  readonly label: string;
  readonly items: readonly WritingCardView[];
}

interface WritingCardView {
  readonly summary: WritingSummary;
  readonly ago: string;
}

const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

@Component({
  selector: 'mc-writings-shelf',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ConfirmDialogComponent,
    NgTemplateOutlet,
    IconComponent,
    TagChipComponent,
    WritingCardComponent,
    NewWritingCardComponent,
    ContinueReadingCardComponent,
    WritingRowComponent,
    WritingSpineComponent,
    FolderBreadcrumbComponent,
    FolderActionDialogComponent,
  ],
  templateUrl: './writings-shelf.container.html',
  styleUrl: './writings-shelf.container.css',
})
export class WritingsShelfContainer {
  private readonly writingsService = inject(WritingsService);
  private readonly tagsService = inject(TagsService);
  private readonly autosave = inject(AutosaveService);
  private readonly workspace = inject(WorkspaceService);
  private readonly foldersService = inject(FoldersService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);

  protected readonly tags = this.tagsService.tags;
  protected readonly summaries = this.writingsService.summaries;
  protected readonly query = signal<string>('');

  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  protected readonly currentFolder = computed(() => this.params().get('folder') ?? '');
  protected readonly allFolders = this.writingsService.folders;

  private readonly inCurrentFolder = computed<readonly WritingSummary[]>(() =>
    this.summaries().filter((s) => s.folder === this.currentFolder()),
  );
  protected readonly activeTagIds = signal<ReadonlySet<string>>(new Set());
  protected readonly sortKey = signal<SortKey>('updated');
  protected readonly creating = signal<boolean>(false);
  protected readonly confirm = new ConfirmController();
  protected readonly folderActionDialog = new FolderActionDialogController();
  protected readonly viewMode = signal<ViewMode>(readStoredViewMode());
  protected readonly groupingEnabled = signal<boolean>(readStoredGrouping());
  protected readonly libraryOpen = signal<boolean>(false);

  protected readonly untitledLabel = computed(() => this.t('writings.untitledTitle'));

  protected readonly availableTags = computed<readonly Tag[]>(() => {
    const used = new Set<string>();
    for (const s of this.summaries()) for (const id of s.tags) used.add(id);
    return this.tags().filter((t) => used.has(t.id));
  });

  protected readonly hasFilter = computed(
    () => this.query().trim() !== '' || this.activeTagIds().size > 0,
  );
  protected readonly continueReading = computed<WritingCardView | null>(() => {
    const sorted = sortSummaries(this.summaries(), 'updated', this.untitledLabel());
    const top = sorted[0];
    if (!top) return null;
    const tt = (key: TranslationKey, params?: Record<string, string | number>): string =>
      this.i18n.t(key, params);
    return { summary: top, ago: formatAgo(top.updatedAt, tt) };
  });
  protected readonly restAll = computed<readonly WritingSummary[]>(() => {
    const cr = this.continueReading();
    return this.inCurrentFolder().filter((s) => !cr || s.id !== cr.summary.id);
  });
  protected readonly restView = computed<readonly WritingCardView[]>(() => {
    const q = norm(this.query().trim());
    const tagSet = this.activeTagIds();
    const filtered = this.restAll().filter((w) => {
      if (tagSet.size > 0 && !w.tags.some((id) => tagSet.has(id))) return false;
      if (!q) return true;
      return norm(`${w.title} ${w.preview}`).includes(q);
    });
    const sorted = sortSummaries(filtered, this.sortKey(), this.untitledLabel());
    const tt = (key: TranslationKey, params?: Record<string, string | number>): string =>
      this.i18n.t(key, params);
    return sorted.map((summary) => ({ summary, ago: formatAgo(summary.updatedAt, tt) }));
  });
  protected readonly displayGroups = computed<readonly DisplayGroup[]>(() => {
    const items = this.restView();
    if (!this.groupingEnabled() || this.hasFilter()) {
      return [{ key: '__all__', label: '', items }];
    }
    const buckets = new Map<string, WritingCardView[]>();
    for (const view of items) {
      const folder = view.summary.folder;
      const key = folder || UNTITLED_GROUP_KEY;
      const list = buckets.get(key);
      if (list) list.push(view);
      else buckets.set(key, [view]);
    }
    const groups: DisplayGroup[] = [];
    for (const [key, arr] of buckets) {
      groups.push({
        key,
        label: key === UNTITLED_GROUP_KEY ? this.t('writings.shelf.group.untitled') : key,
        items: arr,
      });
    }
    groups.sort((a, b) => {
      if (a.key === UNTITLED_GROUP_KEY) return 1;
      if (b.key === UNTITLED_GROUP_KEY) return -1;
      return a.label.localeCompare(b.label);
    });
    return groups;
  });
  protected readonly empty = computed(() => this.inCurrentFolder().length === 0);
  protected readonly noMatch = computed(
    () => this.hasFilter() && this.restView().length === 0 && this.restAll().length > 0,
  );

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onOpen(id: string, title: string): void {
    void this.router.navigate(['/writings', entitySlugSegment(title, id)]);
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

  protected onOpenLibrary(): void {
    this.libraryOpen.set(true);
  }

  protected onCloseLibrary(): void {
    this.libraryOpen.set(false);
  }

  protected onLibraryKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.onCloseLibrary();
    }
  }

  protected libraryButtonLabel(): string {
    return this.i18n.t('writings.shelf.library.open', { n: this.restAll().length });
  }

  protected onToggleGrouping(): void {
    const next = !this.groupingEnabled();
    this.groupingEnabled.set(next);
    try {
      localStorage.setItem(GROUPING_STORAGE_KEY, next ? '1' : '0');
    } catch {
      // why: localStorage may be unavailable; UI still toggles in-memory
    }
  }

  protected onViewModeChange(mode: ViewMode): void {
    if (this.viewMode() === mode) return;
    this.viewMode.set(mode);
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    } catch {
      // why: localStorage may be unavailable in private mode; UI keeps working ephemerally
    }
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
      const writing = await this.writingsService.create(title, this.currentFolder());
      await this.router.navigate(['/writings', entitySlugSegment(writing.title, writing.id)]);
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    } finally {
      this.creating.set(false);
    }
  }

  protected onDelete(id: string): void {
    const summary = this.summaries().find((s) => s.id === id);
    const label = summary?.title || this.untitledLabel();
    this.confirm.ask(
      {
        title: this.t('writings.confirm.delete.title'),
        message: this.t('writings.deleteConfirm').replace('{title}', label),
        confirmLabel: this.t('writings.confirm.delete.confirm'),
        cancelLabel: this.t('writings.confirm.cancel'),
        tone: 'danger',
      },
      async () => {
        try {
          await this.writingsService.deleteToTrash(id);
          await this.autosave.clear(id);
        } catch (e) {
          this.errors.report(e);
        }
      },
    );
  }

  protected onFolderNavigate(path: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { folder: path || null },
      queryParamsHandling: 'merge',
    });
  }

  protected async onCreateSubfolder(): Promise<void> {
    await handleCreateFolder('writing', this.foldersService, this.i18n, this.currentFolder());
  }

  protected onManageFolder(path: string): void {
    openFolderActionDialog(
      `writing:${path}`,
      this.foldersService,
      this.i18n,
      this.folderActionDialog,
      (e) => this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize())),
    );
  }
}

const readStoredGrouping = (): boolean => {
  try {
    const stored = localStorage.getItem(GROUPING_STORAGE_KEY);
    if (stored === '1') return true;
    if (stored === '0') return false;
  } catch {
    // why: localStorage may be unavailable; fall through to default
  }
  return false;
};

const readStoredViewMode = (): ViewMode => {
  try {
    const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (isViewMode(stored)) return stored;
  } catch {
    // why: localStorage may be unavailable; fall through to default
  }
  return 'table';
};

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
