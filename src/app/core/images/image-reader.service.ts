import { Injectable, computed, inject, signal } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { FsService } from '@core/fs/fs.service';
import type { FsDirectoryHandle } from '@core/fs/fs.types';
import { getDirByPath } from '@core/fs/walk';
import { WorkspaceService } from '@core/fs/workspace.service';

import { GALLERY_META_FILE, IMAGES_DIR, ORIGINAL_DIR, THUMBS_DIR, THUMB_EXT } from './image-paths';
import type { ImageRefGallery } from './image-reader.types';

interface CacheEntry {
  readonly folder: string;
  readonly slug: string;
  readonly gallery: ImageRefGallery;
}

// why: published by GalleriesService and consumed by anything that wants to
//      reference an image by id (TipTap image-ref nodes embedded in notes /
//      writings). Decouples the consumer from the images feature itself
//      (rule 10) and keeps the on-disk path convention in one place.
@Injectable({ providedIn: 'root' })
export class ImageReaderService {
  private readonly fs = inject(FsService);
  private readonly workspace = inject(WorkspaceService);

  private readonly entries = signal<ReadonlyMap<string, CacheEntry>>(new Map());
  readonly summaries = computed<readonly ImageRefGallery[]>(() => {
    const list = Array.from(this.entries().values()).map((e) => e.gallery);
    return list.sort((a, b) => a.title.localeCompare(b.title));
  });

  register(id: string, folder: string, slug: string, gallery: ImageRefGallery): void {
    this.entries.update((curr) => {
      const next = new Map(curr);
      next.set(id, { folder, slug, gallery });
      return next;
    });
  }

  unregister(id: string): void {
    this.entries.update((curr) => {
      if (!curr.has(id)) return curr;
      const next = new Map(curr);
      next.delete(id);
      return next;
    });
  }

  clear(): void {
    this.entries.set(new Map());
  }

  getGallery(id: string): ImageRefGallery | null {
    return this.entries().get(id)?.gallery ?? null;
  }

  async readThumbBlob(galleryId: string, imageId: string): Promise<Blob | null> {
    const dir = await this.galleryDir(galleryId);
    const thumbsDir = await this.fs.getOrCreateDir(dir, THUMBS_DIR);
    if (!(await this.fs.hasEntry(thumbsDir, `${imageId}.${THUMB_EXT}`))) return null;
    return this.fs.readFile(thumbsDir, `${imageId}.${THUMB_EXT}`);
  }

  async readOriginalBlob(galleryId: string, imageId: string): Promise<Blob> {
    const entry = this.entries().get(galleryId);
    const meta = entry?.gallery.images.find((i) => i.id === imageId);
    if (!entry || !meta) {
      throw new AppError(ERROR_CODES.FS_003, {
        severity: 'error',
        context: { galleryId, imageId },
      });
    }
    const dir = await this.galleryDir(galleryId);
    const originalDir = await this.fs.getOrCreateDir(dir, ORIGINAL_DIR);
    return this.fs.readFile(originalDir, `${imageId}.${meta.ext}`);
  }

  private async galleryDir(id: string): Promise<FsDirectoryHandle> {
    const entry = this.entries().get(id);
    if (!entry) {
      throw new AppError(ERROR_CODES.FS_003, { severity: 'error', context: { galleryId: id } });
    }
    const root = this.workspace.root();
    if (!root) {
      throw new AppError(ERROR_CODES.FS_003, { severity: 'error', context: { galleryId: id } });
    }
    const imagesDir = await this.fs.getOrCreateDir(root, IMAGES_DIR);
    const parent = entry.folder ? await getDirByPath(this.fs, imagesDir, entry.folder) : imagesDir;
    if (!parent) {
      throw new AppError(ERROR_CODES.FS_003, { severity: 'error', context: { galleryId: id } });
    }
    return this.fs.getOrCreateDir(parent, entry.slug);
  }
}

export { GALLERY_META_FILE };
