import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';

import { AutosaveService } from '@core/autosave/autosave.service';
import { ErrorService } from '@core/errors/error.service';
import { withReauthIfNeeded } from '@core/errors/with-reauth';
import { WorkspaceService } from '@core/fs/workspace.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { EntityLockController } from '@core/locks/entity-lock.controller';
import { TagsService } from '@core/tags/tags.service';
import { IconComponent } from '@shared/icon/icon.component';
import { LockBannerComponent } from '@shared/lock-banner/lock-banner.component';
import { reorderById } from '@shared/utils/reorder';

import {
  FileCollectionMetaBarComponent,
  type FileCollectionSaveStatus,
} from '../components/file-collection-meta-bar.component';
import { FileGridComponent } from '../components/file-grid.component';
import { FILE_KIND, type FileCollection } from '../models/file-collection.types';
import { FilesService } from '../services/files.service';
import { FilesIndexRailContainer } from './files-index-rail.container';

@Component({
  selector: 'mc-files',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FileCollectionMetaBarComponent,
    FileGridComponent,
    IconComponent,
    LockBannerComponent,
    FilesIndexRailContainer,
  ],
  templateUrl: './files.container.html',
  styleUrl: './files.container.css',
})
export class FilesContainer {
  readonly id = input<string | undefined>(undefined);

  private readonly filesService = inject(FilesService);
  private readonly autosave = inject(AutosaveService);
  private readonly workspace = inject(WorkspaceService);
  private readonly tagsService = inject(TagsService);
  private readonly router = inject(Router);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tags = this.tagsService.tags;
  protected readonly active = signal<FileCollection | null>(null);
  protected readonly status = signal<FileCollectionSaveStatus>('saved');
  protected readonly previewUrls = signal<Record<string, string>>({});
  protected readonly lock = new EntityLockController(FILE_KIND, this.active);

  constructor() {
    effect(() => {
      const wanted = this.id();
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

  protected async onDeleteCollection(): Promise<void> {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    const ok = confirm(
      this.t('files.deleteConfirm').replace(
        '{title}',
        current.title || this.t('files.untitledTitle'),
      ),
    );
    if (!ok) return;
    try {
      await this.filesService.deleteCollectionToTrash(current.id);
      await this.autosave.clear(current.id);
      this.active.set(null);
      await this.router.navigate(['/files']);
    } catch (e) {
      this.errors.report(e);
    }
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

  protected async onRemoveItem(itemId: string): Promise<void> {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    const item = current.items.find((i) => i.id === itemId);
    if (!item) return;
    if (!confirm(this.t('files.items.deleteConfirm').replace('{name}', item.originalName))) return;
    try {
      await this.filesService.removeFile(current.id, itemId);
      const next = await this.filesService.readCollection(current.id);
      this.active.set(next);
      await this.refreshPreviewsFor(next);
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected async onMoveUp(itemId: string): Promise<void> {
    await this.swap(itemId, -1);
  }

  protected async onMoveDown(itemId: string): Promise<void> {
    await this.swap(itemId, +1);
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
      a.download = item.originalName;
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
}
