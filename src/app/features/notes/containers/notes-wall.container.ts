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
import { TagsService } from '@core/tags/tags.service';
import { ConfirmController } from '@shared/confirm-dialog/confirm-controller';
import { ConfirmDialogComponent } from '@shared/confirm-dialog/confirm-dialog.component';
import { FolderActionDialogComponent } from '@shared/folder-action-dialog/folder-action-dialog.component';
import { FolderActionDialogController } from '@shared/folder-action-dialog/folder-action-dialog.controller';
import { FolderBreadcrumbComponent } from '@shared/folder-breadcrumb/folder-breadcrumb.component';
import { IconComponent } from '@shared/icon/icon.component';

import { NoteComposeComponent } from '../components/note-compose.component';
import { NoteSlipComponent } from '../components/note-slip.component';
import { NotesFilterBarComponent } from '../components/notes-filter-bar.component';
import type { NoteSummary } from '../models/note.types';
import { NotesService } from '../services/notes.service';
import { registerNotesFoldersTutorial } from './notes-folders.tutorial';
import { registerNotesTutorial } from './notes.tutorial';

const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

@Component({
  selector: 'mc-notes-wall',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ConfirmDialogComponent,
    IconComponent,
    NoteSlipComponent,
    NoteComposeComponent,
    NotesFilterBarComponent,
    FolderBreadcrumbComponent,
    FolderActionDialogComponent,
  ],
  templateUrl: './notes-wall.container.html',
  styleUrl: './notes-wall.container.css',
})
export class NotesWallContainer {
  private readonly notesService = inject(NotesService);
  private readonly tagsService = inject(TagsService);
  private readonly autosave = inject(AutosaveService);
  private readonly workspace = inject(WorkspaceService);
  private readonly foldersService = inject(FoldersService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);

  constructor() {
    registerNotesTutorial();
    registerNotesFoldersTutorial();
  }

  protected readonly tags = this.tagsService.tags;
  protected readonly summaries = this.notesService.summaries;
  protected readonly query = signal<string>('');
  protected readonly activeTagIds = signal<ReadonlySet<string>>(new Set());
  protected readonly creating = signal<boolean>(false);
  protected readonly confirm = new ConfirmController();
  protected readonly folderActionDialog = new FolderActionDialogController();

  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  protected readonly currentFolder = computed(() => this.params().get('folder') ?? '');
  protected readonly allFolders = this.notesService.folders;

  protected readonly untitledLabel = computed(() => this.t('notes.untitledTitle'));
  protected readonly availableTags = computed(() => {
    const used = new Set<string>();
    for (const s of this.summaries()) for (const id of s.tags) used.add(id);
    return this.tags().filter((t) => used.has(t.id));
  });
  private readonly inCurrentFolder = computed<readonly NoteSummary[]>(() => {
    const folder = this.currentFolder();
    return this.summaries().filter((n) => n.folder === folder);
  });
  // why: ticker shows newest first, but service orders ascending by position.
  protected readonly visible = computed<readonly NoteSummary[]>(() => {
    const q = norm(this.query().trim());
    const tagSet = this.activeTagIds();
    const filtered = this.inCurrentFolder().filter((n) => {
      if (tagSet.size > 0 && !n.tags.some((id) => tagSet.has(id))) return false;
      if (!q) return true;
      return norm(`${n.title} ${n.preview}`).includes(q);
    });
    return [...filtered].reverse();
  });
  protected readonly hasFilter = computed(
    () => this.query().trim() !== '' || this.activeTagIds().size > 0,
  );
  protected readonly noMatch = computed(
    () => this.hasFilter() && this.visible().length === 0 && this.inCurrentFolder().length > 0,
  );
  protected readonly empty = computed(
    () => this.inCurrentFolder().length === 0 && !this.hasFilter(),
  );

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onOpen(id: string, title: string): void {
    void this.router.navigate(['/notes', entitySlugSegment(title, id)]);
  }

  protected async onCreate(title: string): Promise<void> {
    if (this.creating()) return;
    this.creating.set(true);
    try {
      await this.workspace.ensureWritable();
      await this.notesService.create(title, this.currentFolder());
    } catch (e) {
      this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize()));
    } finally {
      this.creating.set(false);
    }
  }

  protected onDelete(id: string): void {
    const summary = this.summaries().find((s) => s.id === id);
    const label = summary?.title || this.t('notes.untitledTitle');
    this.confirm.ask(
      {
        title: this.t('notes.confirm.delete.title'),
        message: this.t('notes.deleteConfirm').replace('{title}', label),
        confirmLabel: this.t('notes.confirm.delete.confirm'),
        cancelLabel: this.t('notes.confirm.cancel'),
        tone: 'danger',
      },
      async () => {
        try {
          await this.notesService.deleteToTrash(id);
          await this.autosave.clear(id);
        } catch (e) {
          this.errors.report(e);
        }
      },
    );
  }

  protected onToggleTag(id: string): void {
    this.activeTagIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected onQueryChange(value: string): void {
    this.query.set(value);
  }

  protected onClearFilters(): void {
    this.query.set('');
    this.activeTagIds.set(new Set());
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
      'note',
      this.foldersService,
      this.i18n,
      this.folderActionDialog,
      (e) => this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize())),
      this.currentFolder(),
    );
  }

  protected onManageFolder(path: string): void {
    openFolderActionDialog(
      `note:${path}`,
      this.foldersService,
      this.i18n,
      this.folderActionDialog,
      (e) => this.errors.report(withReauthIfNeeded(e, () => this.workspace.reauthorize())),
    );
  }
}
