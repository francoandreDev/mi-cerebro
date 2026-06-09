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
import { LockBannerComponent } from '@shared/lock-banner/lock-banner.component';

import {
  GalleryMetaBarComponent,
  type GallerySaveStatus,
} from '../components/gallery-meta-bar.component';
import { ImageGridComponent } from '../components/image-grid.component';
import { ImageLightboxComponent } from '../components/image-lightbox.component';
import { IMAGE_KIND, type Gallery, type GalleryImage } from '../models/gallery.types';
import { GalleriesService } from '../services/galleries.service';

@Component({
  selector: 'mc-galleries',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    GalleryMetaBarComponent,
    ImageGridComponent,
    ImageLightboxComponent,
    LockBannerComponent,
  ],
  templateUrl: './galleries.container.html',
  styleUrl: './galleries.container.css',
})
export class GalleriesContainer {
  readonly id = input<string | undefined>(undefined);

  private readonly galleriesService = inject(GalleriesService);
  private readonly autosave = inject(AutosaveService);
  private readonly workspace = inject(WorkspaceService);
  private readonly tagsService = inject(TagsService);
  private readonly router = inject(Router);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tags = this.tagsService.tags;
  protected readonly active = signal<Gallery | null>(null);
  protected readonly status = signal<GallerySaveStatus>('saved');
  protected readonly thumbUrls = signal<Record<string, string>>({});
  protected readonly originalUrls = signal<Record<string, string>>({});
  protected readonly openImageId = signal<string | null>(null);
  protected readonly lock = new EntityLockController(IMAGE_KIND, this.active);

  constructor() {
    effect(() => {
      const wanted = this.id();
      const current = this.active();
      if (!wanted) {
        if (current) {
          this.active.set(null);
          this.revokeAll();
        }
        return;
      }
      if (current?.id !== wanted) {
        void this.loadGallery(wanted);
      }
    });
    this.destroyRef.onDestroy(() => this.revokeAll());
  }

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected openImage(): GalleryImage | null {
    const id = this.openImageId();
    const g = this.active();
    if (!id || !g) return null;
    return g.images.find((i) => i.id === id) ?? null;
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

  protected async onDeleteGallery(): Promise<void> {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    const ok = confirm(
      this.t('images.deleteConfirm').replace(
        '{title}',
        current.title || this.t('images.untitledTitle'),
      ),
    );
    if (!ok) return;
    try {
      await this.galleriesService.deleteGalleryToTrash(current.id);
      await this.autosave.clear(current.id);
      this.active.set(null);
      this.revokeAll();
      await this.router.navigate(['/images']);
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
        await this.galleriesService.addImage(current.id, file, file.name);
      }
      const next = await this.galleriesService.readGallery(current.id);
      this.active.set(next);
      await this.refreshUrlsFor(next);
    } catch (e) {
      this.errors.report(this.withReauthIfNeeded(e));
    }
  }

  protected async onRemoveImage(imageId: string): Promise<void> {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    const img = current.images.find((i) => i.id === imageId);
    if (!img) return;
    if (!confirm(this.t('images.images.deleteConfirm').replace('{name}', img.originalName))) return;
    try {
      await this.galleriesService.removeImage(current.id, imageId);
      const next = await this.galleriesService.readGallery(current.id);
      this.active.set(next);
      this.revokeOne(imageId);
      if (this.openImageId() === imageId) this.openImageId.set(null);
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected async onMoveUp(imageId: string): Promise<void> {
    await this.swap(imageId, -1);
  }

  protected async onMoveDown(imageId: string): Promise<void> {
    await this.swap(imageId, +1);
  }

  protected async onOpenImage(imageId: string): Promise<void> {
    const current = this.active();
    if (!current) return;
    this.openImageId.set(imageId);
    const urls = this.originalUrls();
    if (urls[imageId]) return;
    try {
      const blob = await this.galleriesService.readOriginalBlob(current.id, imageId);
      const url = URL.createObjectURL(blob);
      this.originalUrls.update((map) => ({ ...map, [imageId]: url }));
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected onCloseLightbox(): void {
    this.openImageId.set(null);
  }

  private async swap(imageId: string, delta: number): Promise<void> {
    const current = this.active();
    if (!current || !this.lock.guardWrite()) return;
    const order = [...current.order];
    const idx = order.indexOf(imageId);
    if (idx < 0) return;
    const target = idx + delta;
    if (target < 0 || target >= order.length) return;
    const a = order[idx];
    const b = order[target];
    if (a === undefined || b === undefined) return;
    order[idx] = b;
    order[target] = a;
    try {
      await this.galleriesService.reorderImages(current.id, order);
      this.active.set(await this.galleriesService.readGallery(current.id));
    } catch (e) {
      this.errors.report(e);
    }
  }

  private async loadGallery(id: string): Promise<void> {
    try {
      const gallery = await this.galleriesService.readGallery(id);
      this.active.set(gallery);
      this.status.set('saved');
      this.revokeAll();
      await this.refreshUrlsFor(gallery);
    } catch (e) {
      this.errors.report(e);
      this.active.set(null);
    }
  }

  private async refreshUrlsFor(gallery: Gallery): Promise<void> {
    const next: Record<string, string> = { ...this.thumbUrls() };
    const existing = new Set(Object.keys(next));
    for (const img of gallery.images) {
      if (next[img.id]) {
        existing.delete(img.id);
        continue;
      }
      try {
        const thumb = await this.galleriesService.readThumbBlob(gallery.id, img.id);
        if (thumb) {
          next[img.id] = URL.createObjectURL(thumb);
        } else {
          const original = await this.galleriesService.readOriginalBlob(gallery.id, img.id);
          next[img.id] = URL.createObjectURL(original);
        }
      } catch (cause) {
        console.warn('[images] thumb load failed', img.id, cause);
      }
      existing.delete(img.id);
    }
    for (const orphan of existing) {
      URL.revokeObjectURL(next[orphan]!);
      delete next[orphan];
    }
    this.thumbUrls.set(next);
  }

  private revokeOne(imageId: string): void {
    const thumbs = this.thumbUrls();
    const originals = this.originalUrls();
    if (thumbs[imageId]) {
      URL.revokeObjectURL(thumbs[imageId]);
      const { [imageId]: _t, ...rest } = thumbs;
      void _t;
      this.thumbUrls.set(rest);
    }
    if (originals[imageId]) {
      URL.revokeObjectURL(originals[imageId]);
      const { [imageId]: _o, ...rest } = originals;
      void _o;
      this.originalUrls.set(rest);
    }
  }

  private revokeAll(): void {
    for (const url of Object.values(this.thumbUrls())) URL.revokeObjectURL(url);
    for (const url of Object.values(this.originalUrls())) URL.revokeObjectURL(url);
    this.thumbUrls.set({});
    this.originalUrls.set({});
  }

  private scheduleSave(gallery: Gallery): void {
    this.status.set('unsaved');
    this.autosave.schedule<Gallery>(gallery.id, IMAGE_KIND, () => gallery, {
      onFlush: async (payload) => {
        this.status.set('saving');
        try {
          await this.galleriesService.saveGallery(payload);
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
