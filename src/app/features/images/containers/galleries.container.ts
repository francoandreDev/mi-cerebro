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
import { orderItems, paginateCuartos } from '@shared/utils/museum-asymmetry';

import {
  GalleryMetaBarComponent,
  type GallerySaveStatus,
} from '../components/gallery-meta-bar.component';
import { ImageLightboxComponent } from '../components/image-lightbox.component';
import { MuseumRoomComponent } from '../components/museum-room.component';
import { RoomMinimapComponent } from '../components/room-minimap.component';
import { IMAGE_KIND, type Gallery, type GalleryImage } from '../models/gallery.types';
import { GalleriesService } from '../services/galleries.service';
import { GalleryUrlCache } from './gallery-url-cache';

@Component({
  selector: 'mc-galleries',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    GalleryMetaBarComponent,
    IconComponent,
    ImageLightboxComponent,
    LockBannerComponent,
    MuseumRoomComponent,
    RoomMinimapComponent,
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
  private readonly urls = new GalleryUrlCache(this.galleriesService);
  protected readonly thumbUrls = this.urls.thumbs;
  protected readonly originalUrls = this.urls.originals;
  protected readonly openImageId = signal<string | null>(null);
  protected readonly cuartoIndex = signal<number>(0);
  protected readonly lock = new EntityLockController(IMAGE_KIND, this.active);

  protected readonly orderedImages = computed<readonly GalleryImage[]>(() => {
    const g = this.active();
    return g ? orderItems(g.images, g.order) : [];
  });

  protected readonly cuartos = computed<readonly (readonly GalleryImage[])[]>(() =>
    paginateCuartos(this.orderedImages()),
  );

  protected readonly cuartoSizes = computed<readonly number[]>(() =>
    this.cuartos().map((c) => c.length),
  );

  protected readonly currentCuarto = computed<readonly GalleryImage[]>(
    () => this.cuartos()[this.cuartoIndex()] ?? [],
  );

  protected readonly cuartosCount = computed<number>(() => this.cuartos().length);

  constructor() {
    effect(() => {
      const wanted = this.id();
      const current = this.active();
      if (!wanted) {
        if (current) {
          this.active.set(null);
          this.urls.revokeAll();
        }
        return;
      }
      if (current?.id !== wanted) {
        void this.loadGallery(wanted);
      }
    });
    effect(() => {
      const max = Math.max(0, this.cuartosCount() - 1);
      if (this.cuartoIndex() > max) this.cuartoIndex.set(max);
    });
    this.destroyRef.onDestroy(() => this.urls.revokeAll());
    const onPaste = (event: ClipboardEvent): void => this.handlePaste(event);
    document.addEventListener('paste', onPaste);
    this.destroyRef.onDestroy(() => document.removeEventListener('paste', onPaste));
  }

  // why: paste at document level so we don't need the user to click into the
  //      gallery first. We bail when the focus is inside a real input/editor
  //      so the user can still paste text into the title or tag picker.
  private handlePaste(event: ClipboardEvent): void {
    if (!this.active() || !this.lock.editable()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, [contenteditable="true"], [contenteditable=""]')) return;
    const items = event.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of Array.from(items)) {
      if (item.kind !== 'file' || !item.type.startsWith('image/')) continue;
      const f = item.getAsFile();
      if (f) files.push(f);
    }
    if (files.length === 0) return;
    event.preventDefault();
    void this.onAddFiles(files);
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
      this.urls.revokeAll();
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
      await this.urls.refreshThumbs(next);
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
      this.urls.revokeOne(imageId);
      if (this.openImageId() === imageId) this.openImageId.set(null);
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected onNextCuarto(): void {
    const next = Math.min(this.cuartoIndex() + 1, this.cuartosCount() - 1);
    this.cuartoIndex.set(next);
  }

  protected onPrevCuarto(): void {
    this.cuartoIndex.set(Math.max(this.cuartoIndex() - 1, 0));
  }

  protected onJumpCuarto(index: number): void {
    const clamped = Math.max(0, Math.min(index, this.cuartosCount() - 1));
    this.cuartoIndex.set(clamped);
  }

  protected async onOpenImage(imageId: string): Promise<void> {
    const current = this.active();
    if (!current) return;
    this.openImageId.set(imageId);
    try {
      await this.urls.loadOriginal(current.id, imageId);
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected onCloseLightbox(): void {
    this.openImageId.set(null);
  }

  private async loadGallery(id: string): Promise<void> {
    try {
      const gallery = await this.galleriesService.readGallery(id);
      this.active.set(gallery);
      this.cuartoIndex.set(0);
      this.status.set('saved');
      this.urls.revokeAll();
      await this.urls.refreshThumbs(gallery);
    } catch (e) {
      this.errors.report(e);
      this.active.set(null);
    }
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
