import type { ElementRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
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
import { TagsService } from '@core/tags/tags.service';
import { ConfirmController } from '@shared/confirm-dialog/confirm-controller';
import { ConfirmDialogComponent } from '@shared/confirm-dialog/confirm-dialog.component';
import { FolderActionDialogComponent } from '@shared/folder-action-dialog/folder-action-dialog.component';
import { FolderActionDialogController } from '@shared/folder-action-dialog/folder-action-dialog.controller';
import { FolderBreadcrumbComponent } from '@shared/folder-breadcrumb/folder-breadcrumb.component';
import { IconComponent } from '@shared/icon/icon.component';

import { ChalkEntryComponent } from '../components/chalk-entry.component';
import { ChalkNewEntryComponent } from '../components/chalk-new-entry.component';
import { ChalkRailComponent } from '../components/chalk-rail.component';
import type { ChalkAxis, RailGroup } from '../components/chalk-rail.component';
import type { ListSummary } from '../models/list.types';
import { ListsService } from '../services/lists.service';

interface Section {
  readonly key: string;
  readonly label: string;
  readonly color?: string | undefined;
  readonly lists: readonly ListSummary[];
}

const ALPHA = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
const UNTAGGED_KEY = '__untagged__';
const HASH_KEY = '#';

const stripDiacritics = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

const firstLetter = (title: string): string => {
  const trimmed = title.trim();
  if (!trimmed) return HASH_KEY;
  const c = trimmed.charAt(0).toUpperCase();
  if (c === 'Ñ') return 'Ñ';
  const ascii = stripDiacritics(c);
  return /^[A-Z]$/.test(ascii) ? ascii : HASH_KEY;
};

@Component({
  selector: 'mc-lists-shelf',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ConfirmDialogComponent,
    IconComponent,
    ChalkEntryComponent,
    ChalkNewEntryComponent,
    ChalkRailComponent,
    FolderBreadcrumbComponent,
    FolderActionDialogComponent,
  ],
  templateUrl: './lists-shelf.container.html',
  styleUrl: './lists-shelf.container.css',
})
export class ListsShelfContainer {
  private readonly listsService = inject(ListsService);
  private readonly tagsService = inject(TagsService);
  private readonly autosave = inject(AutosaveService);
  private readonly workspace = inject(WorkspaceService);
  private readonly foldersService = inject(FoldersService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);

  protected readonly tags = this.tagsService.tags;
  protected readonly summaries = this.listsService.summaries;
  protected readonly query = signal<string>('');
  protected readonly axis = signal<ChalkAxis>('alpha');
  protected readonly activeKey = signal<string | null>(null);
  protected readonly creating = signal<boolean>(false);
  protected readonly confirm = new ConfirmController();
  protected readonly folderActionDialog = new FolderActionDialogController();

  protected readonly flowRef = viewChild<ElementRef<HTMLElement>>('flow');

  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  protected readonly currentFolder = computed(() => this.params().get('folder') ?? '');
  protected readonly allFolders = this.listsService.folders;

  private readonly inCurrentFolder = computed<readonly ListSummary[]>(() =>
    this.summaries().filter((s) => s.folder === this.currentFolder()),
  );

  protected readonly untitledLabel = computed(() => this.t('lists.untitledTitle'));

  protected readonly sections = computed<readonly Section[]>(() => {
    return this.axis() === 'alpha' ? this.alphaSections() : this.tagSections();
  });

  private readonly alphaSections = computed<readonly Section[]>(() => {
    const buckets = new Map<string, ListSummary[]>();
    for (const s of this.inCurrentFolder()) {
      const k = firstLetter(s.title);
      const arr = buckets.get(k) ?? [];
      arr.push(s);
      buckets.set(k, arr);
    }
    const keys = [...ALPHA, HASH_KEY].filter((k) => buckets.has(k));
    return keys.map((k) => ({
      key: k,
      label: k,
      lists: (buckets.get(k) ?? []).slice().sort(byTitle),
    }));
  });

  private readonly tagSections = computed<readonly Section[]>(() => {
    const byTag = new Map<string, ListSummary[]>();
    const untagged: ListSummary[] = [];
    for (const s of this.inCurrentFolder()) {
      if (s.tags.length === 0) {
        untagged.push(s);
        continue;
      }
      for (const id of s.tags) {
        const arr = byTag.get(id) ?? [];
        arr.push(s);
        byTag.set(id, arr);
      }
    }
    const out: Section[] = [];
    for (const t of this.tags()) {
      const arr = byTag.get(t.id);
      if (!arr || arr.length === 0) continue;
      out.push({ key: t.id, label: t.label, color: t.color, lists: arr.slice().sort(byTitle) });
    }
    if (untagged.length) {
      out.push({
        key: UNTAGGED_KEY,
        label: this.t('lists.board.untagged'),
        lists: untagged.slice().sort(byTitle),
      });
    }
    return out;
  });

  protected readonly railGroups = computed<readonly RailGroup[]>(() => {
    if (this.axis() === 'tag') {
      return this.sections().map((s) => ({ key: s.key, label: s.label, color: s.color }));
    }
    const have = new Set(this.sections().map((s) => s.key));
    return [...ALPHA, HASH_KEY].map((k) => ({
      key: k,
      label: k,
      empty: !have.has(k),
    }));
  });

  protected readonly empty = computed(
    () => this.inCurrentFolder().length === 0 && this.query().trim() === '',
  );
  protected readonly hasQuery = computed(() => this.query().trim() !== '');
  protected readonly anyMatch = computed(() => {
    const q = stripDiacritics(this.query().trim().toLowerCase());
    if (!q) return true;
    return this.inCurrentFolder().some((l) => {
      const hay = stripDiacritics(`${l.title} ${l.previewItems.join(' ')}`.toLowerCase());
      return hay.includes(q);
    });
  });

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onOpen(id: string, title: string): void {
    void this.router.navigate(['/lists', entitySlugSegment(title, id)]);
  }

  protected onQueryInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (target) this.query.set(target.value);
  }

  protected onClearQuery(): void {
    this.query.set('');
  }

  protected onAxisChange(next: ChalkAxis): void {
    this.axis.set(next);
    this.activeKey.set(null);
  }

  protected onJump(key: string): void {
    const root = this.flowRef()?.nativeElement;
    const target = root?.querySelector<HTMLElement>(`[data-section-key="${cssEscape(key)}"]`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.activeKey.set(key);
    }
  }

  protected onScroll(event: Event): void {
    const root = event.target as HTMLElement;
    const headers = root.querySelectorAll<HTMLElement>('[data-section-key]');
    let bestKey: string | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    const topRef = root.getBoundingClientRect().top + 24;
    for (const h of headers) {
      const top = h.getBoundingClientRect().top;
      const dist = Math.abs(top - topRef);
      if (top - topRef <= 0 && dist < bestDist) {
        bestDist = dist;
        bestKey = h.dataset['sectionKey'] ?? null;
      }
    }
    if (bestKey && bestKey !== this.activeKey()) this.activeKey.set(bestKey);
  }

  protected async onCreate(title: string): Promise<void> {
    if (this.creating()) return;
    this.creating.set(true);
    try {
      await this.workspace.ensureWritable();
      const list = await this.listsService.create(title, this.currentFolder());
      await this.router.navigate(['/lists', entitySlugSegment(list.title, list.id)]);
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
        title: this.t('lists.confirm.delete.title'),
        message: this.t('lists.deleteConfirm').replace('{title}', label),
        confirmLabel: this.t('lists.confirm.delete.confirm'),
        cancelLabel: this.t('lists.confirm.cancel'),
        tone: 'danger',
      },
      async () => {
        try {
          await this.listsService.deleteToTrash(id);
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

  protected onCreateSubfolder(): void {
    handleCreateFolder(
      'list',
      this.foldersService,
      this.i18n,
      this.folderActionDialog,
      (e) => this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize())),
      this.currentFolder(),
    );
  }

  protected onManageFolder(path: string): void {
    openFolderActionDialog(
      `list:${path}`,
      this.foldersService,
      this.i18n,
      this.folderActionDialog,
      (e) => this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize())),
    );
  }
}

const byTitle = (a: ListSummary, b: ListSummary): number =>
  stripDiacritics(a.title.toLowerCase()).localeCompare(stripDiacritics(b.title.toLowerCase()));

const cssEscape = (s: string): string => s.replace(/["\\]/g, '\\$&');
