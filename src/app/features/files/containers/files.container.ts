import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
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
import { EntityLockController } from '@core/locks/entity-lock.controller';
import { entitySlugSegment, extractEntityId } from '@core/routing/entity-slug';
import { TagsService } from '@core/tags/tags.service';
import { ConfirmController } from '@shared/confirm-dialog/confirm-controller';
import { ConfirmDialogComponent } from '@shared/confirm-dialog/confirm-dialog.component';
import { FolderActionDialogComponent } from '@shared/folder-action-dialog/folder-action-dialog.component';
import { FolderActionDialogController } from '@shared/folder-action-dialog/folder-action-dialog.controller';
import { FolderBreadcrumbComponent } from '@shared/folder-breadcrumb/folder-breadcrumb.component';
import { IconComponent } from '@shared/icon/icon.component';
import { LockBannerComponent } from '@shared/lock-banner/lock-banner.component';
import { reorderById } from '@shared/utils/reorder';

import {
  FileCollectionMetaBarComponent,
  type FileCollectionSaveStatus,
} from '../components/file-collection-meta-bar.component';
import { FileGridComponent } from '../components/file-grid.component';
import { FileLockerComponent } from '../components/file-locker.component';
import { FILE_KIND, displayLabel, type FileCollection } from '../models/file-collection.types';

// why: under this threshold the open locker expands inline within the wall;
//      above it, the content jumps to an overlay so it doesn't shove the rest
//      of the wall off-screen.
const INLINE_ITEMS_THRESHOLD = 6;
import { FilesService } from '../services/files.service';
import { registerFilesTutorial } from './files.tutorial';

@Component({
  selector: 'mc-files',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ConfirmDialogComponent,
    FileCollectionMetaBarComponent,
    FileGridComponent,
    FileLockerComponent,
    IconComponent,
    LockBannerComponent,
    NgTemplateOutlet,
    FolderBreadcrumbComponent,
    FolderActionDialogComponent,
  ],
  templateUrl: './files.container.html',
  styleUrl: './files.container.css',
})
export class FilesContainer {
  readonly id = input<string | undefined>(undefined);

  protected readonly filesService = inject(FilesService);
  private readonly autosave = inject(AutosaveService);
  private readonly workspace = inject(WorkspaceService);
  private readonly tagsService = inject(TagsService);
  private readonly foldersService = inject(FoldersService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tags = this.tagsService.tags;
  protected readonly active = signal<FileCollection | null>(null);

  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  protected readonly currentFolder = computed(() => this.params().get('folder') ?? '');
  protected readonly allFolders = this.filesService.folders;

  protected readonly visibleCollections = computed(() =>
    this.filesService.summaries().filter((s) => s.folder === this.currentFolder()),
  );
  protected readonly status = signal<FileCollectionSaveStatus>('saved');
  protected readonly inlineMode = computed(() => {
    const c = this.active();
    return c !== null && c.items.length <= INLINE_ITEMS_THRESHOLD;
  });
  protected readonly previewUrls = signal<Record<string, string>>({});
  protected readonly lock = new EntityLockController(FILE_KIND, this.active);
  protected readonly confirm = new ConfirmController();
  protected readonly folderActionDialog = new FolderActionDialogController();

  constructor() {
    registerFilesTutorial();
    effect(() => {
      const raw = this.id();
      const wanted = raw ? extractEntityId(raw) : undefined;
      const current = this.active();
      if (!wanted) {
        if (current) this.active.set(null);
        return;
      }
      if (current?.id !== wanted) void this.loadCollection(wanted);
    });
    this.destroyRef.onDestroy(() => this.revokeAllPreviews());
  }

  private isPreviewable(mime: string): boolean {
    return mime.startsWith('image/') || mime === 'application/pdf';
  }

  private revokeAllPreviews(): void {
    for (const url of Object.values(this.previewUrls())) URL.revokeObjectURL(url);
    this.previewUrls.set({});
  }

  private async refreshPreviewsFor(collection: FileCollection): Promise<void> {
    const next: Record<string, string> = { ...this.previewUrls() };
    const stale = new Set(Object.keys(next));
    for (const item of collection.items) {
      stale.delete(item.id);
      if (next[item.id] || !this.isPreviewable(item.mime)) continue;
      try {
        const blob = await this.filesService.readBlob(collection.id, item.id);
        next[item.id] = URL.createObjectURL(blob);
      } catch (cause) {
        console.warn('[files] preview load failed', item.id, cause);
      }
    }
    for (const orphan of stale) {
      const url = next[orphan];
      if (url) URL.revokeObjectURL(url);
      delete next[orphan];
    }
    this.previewUrls.set(next);
  }

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onTitleChange(title: string): void {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    const next = { ...current, title };
    this.active.set(next);
    this.scheduleSave(next);
  }

  protected async onAddTag(label: string): Promise<void> {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    try {
      await this.workspace.ensureWritable();
      const tag = await this.tagsService.touch(label);
      if (current.tags.includes(tag.id)) return;
      const next = { ...current, tags: [...current.tags, tag.id] };
      this.active.set(next);
      this.scheduleSave(next);
    } catch (e) {
      this.errors.report(this.withReauthIfNeeded(e));
    }
  }

  protected onRemoveTag(id: string): void {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    if (!current.tags.includes(id)) return;
    const next = { ...current, tags: current.tags.filter((t) => t !== id) };
    this.active.set(next);
    this.scheduleSave(next);
  }

  protected async onBackToIndex(event?: Event): Promise<void> {
    event?.preventDefault();
    await this.router.navigate(['/files']);
  }

  protected async onOpenCollection(id: string, title: string): Promise<void> {
    await this.router.navigate(['/files', entitySlugSegment(title, id, 'coleccion')]);
  }

  protected async onCreateCollection(): Promise<void> {
    try {
      await this.workspace.ensureWritable();
      const created = await this.filesService.createCollection('', this.currentFolder());
      await this.router.navigate([
        '/files',
        entitySlugSegment(created.title, created.id, 'coleccion'),
      ]);
    } catch (e) {
      this.errors.report(this.withReauthIfNeeded(e));
    }
  }

  protected onDeleteCollection(): void {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    this.confirm.ask(
      {
        title: this.t('files.confirm.deleteCollection.title'),
        message: this.t('files.deleteConfirm').replace(
          '{title}',
          current.title || this.t('files.untitledTitle'),
        ),
        confirmLabel: this.t('files.confirm.deleteCollection.confirm'),
        cancelLabel: this.t('files.confirm.cancel'),
        tone: 'danger',
      },
      async () => {
        try {
          await this.filesService.deleteCollectionToTrash(current.id);
          await this.autosave.clear(current.id);
          this.active.set(null);
          await this.router.navigate(['/files']);
        } catch (e) {
          this.errors.report(e);
        }
      },
    );
  }

  protected async onAddFiles(files: readonly File[]): Promise<void> {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    try {
      await this.workspace.ensureWritable();
      for (const file of files) {
        await this.filesService.addFile(current.id, file, file.name);
      }
      const next = await this.filesService.readCollection(current.id);
      this.active.set(next);
      await this.refreshPreviewsFor(next);
    } catch (e) {
      this.errors.report(this.withReauthIfNeeded(e));
    }
  }

  protected onRemoveItem(itemId: string): void {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    const item = current.items.find((i) => i.id === itemId);
    if (!item) return;
    this.confirm.ask(
      {
        title: this.t('files.confirm.deleteItem.title'),
        message: this.t('files.items.deleteConfirm').replace('{name}', displayLabel(item)),
        confirmLabel: this.t('files.confirm.deleteItem.confirm'),
        cancelLabel: this.t('files.confirm.cancel'),
        tone: 'danger',
      },
      async () => {
        try {
          await this.filesService.removeFile(current.id, itemId);
          const next = await this.filesService.readCollection(current.id);
          this.active.set(next);
          await this.refreshPreviewsFor(next);
        } catch (e) {
          this.errors.report(e);
        }
      },
    );
  }

  protected async onMoveUp(itemId: string): Promise<void> {
    await this.swap(itemId, -1);
  }

  protected async onMoveDown(itemId: string): Promise<void> {
    await this.swap(itemId, +1);
  }

  protected async onRenameItem(payload: { id: string; name: string }): Promise<void> {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    try {
      await this.filesService.renameFile(current.id, payload.id, payload.name);
      const next = await this.filesService.readCollection(current.id);
      this.active.set(next);
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected async onReorder(payload: { from: string; to: string }): Promise<void> {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    const order = reorderById(current.order, payload.from, payload.to);
    if (order === current.order) return;
    try {
      await this.filesService.reorderFiles(current.id, order);
      this.active.set(await this.filesService.readCollection(current.id));
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected async onDownload(itemId: string): Promise<void> {
    const current = this.active();
    if (!current) return;
    const item = current.items.find((i) => i.id === itemId);
    if (!item) return;
    try {
      const blob = await this.filesService.readBlob(current.id, itemId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName(item);
      document.body.appendChild(a);
      a.click();
      a.remove();
      // why: revoke after the browser has had a tick to start the download.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      this.errors.report(e);
    }
  }

  private async swap(itemId: string, delta: number): Promise<void> {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    const order = [...current.order];
    const idx = order.indexOf(itemId);
    if (idx < 0) return;
    const target = idx + delta;
    if (target < 0 || target >= order.length) return;
    const a = order[idx];
    const b = order[target];
    if (a === undefined || b === undefined) return;
    order[idx] = b;
    order[target] = a;
    try {
      await this.filesService.reorderFiles(current.id, order);
      this.active.set(await this.filesService.readCollection(current.id));
    } catch (e) {
      this.errors.report(e);
    }
  }

  private async loadCollection(id: string): Promise<void> {
    try {
      const collection = await this.filesService.readCollection(id);
      this.active.set(collection);
      this.status.set('saved');
      this.revokeAllPreviews();
      await this.refreshPreviewsFor(collection);
    } catch (e) {
      this.errors.report(e);
      this.active.set(null);
    }
  }

  private scheduleSave(collection: FileCollection): void {
    this.status.set('unsaved');
    this.autosave.schedule<FileCollection>(collection.id, FILE_KIND, () => collection, {
      onFlush: async (payload) => {
        this.status.set('saving');
        try {
          await this.filesService.saveCollection(payload);
          await this.autosave.clear(payload.id);
          this.status.set('saved');
        } catch (e) {
          this.errors.report(this.withReauthIfNeeded(e, () => this.scheduleSave(payload)));
          this.status.set('unsaved');
        }
      },
    });
  }

  private withReauthIfNeeded(error: unknown, retry?: () => void): unknown {
    return withReauthIfNeeded(error, () => this.workspace.reauthorize(), retry);
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
      'file',
      this.foldersService,
      this.i18n,
      this.folderActionDialog,
      (e) => this.errors.report(this.withReauthIfNeeded(e)),
      this.currentFolder(),
    );
  }

  protected onManageFolder(path: string): void {
    openFolderActionDialog(
      `file:${path}`,
      this.foldersService,
      this.i18n,
      this.folderActionDialog,
      (e) => this.errors.report(this.withReauthIfNeeded(e)),
    );
  }
}

// why: preserve the original extension when downloading a renamed file so the
//      OS still recognises the format even if the user dropped or changed it.
const downloadName = (item: {
  originalName: string;
  displayName?: string;
  ext: string;
}): string => {
  const chosen =
    item.displayName && item.displayName.trim() !== '' ? item.displayName : item.originalName;
  if (chosen === item.originalName) return item.originalName;
  const hasExt = chosen.toLowerCase().endsWith(`.${item.ext.toLowerCase()}`);
  return hasExt ? chosen : `${chosen}.${item.ext}`;
};
