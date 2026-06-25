import { signal } from '@angular/core';

import type { Gallery } from '../models/gallery.types';
import type { GalleriesService } from '../services/galleries.service';

export class GalleryUrlCache {
  readonly thumbs = signal<Record<string, string>>({});
  readonly originals = signal<Record<string, string>>({});

  constructor(private readonly svc: GalleriesService) {}

  async refreshThumbs(gallery: Gallery): Promise<void> {
    const next: Record<string, string> = { ...this.thumbs() };
    const orphans = new Set(Object.keys(next));
    for (const img of gallery.images) {
      orphans.delete(img.id);
      if (next[img.id]) continue;
      try {
        const thumb = await this.svc.readThumbBlob(gallery.id, img.id);
        const blob = thumb ?? (await this.svc.readOriginalBlob(gallery.id, img.id));
        next[img.id] = URL.createObjectURL(blob);
      } catch (cause) {
        console.warn('[images] thumb load failed', img.id, cause);
      }
    }
    for (const id of orphans) {
      URL.revokeObjectURL(next[id]!);
      delete next[id];
    }
    this.thumbs.set(next);
  }

  async loadOriginal(galleryId: string, imageId: string): Promise<void> {
    if (this.originals()[imageId]) return;
    const blob = await this.svc.readOriginalBlob(galleryId, imageId);
    const url = URL.createObjectURL(blob);
    this.originals.update((map) => ({ ...map, [imageId]: url }));
  }

  revokeOne(imageId: string): void {
    const t = this.thumbs();
    if (t[imageId]) {
      URL.revokeObjectURL(t[imageId]);
      const { [imageId]: _t, ...rest } = t;
      void _t;
      this.thumbs.set(rest);
    }
    const o = this.originals();
    if (o[imageId]) {
      URL.revokeObjectURL(o[imageId]);
      const { [imageId]: _o, ...rest } = o;
      void _o;
      this.originals.set(rest);
    }
  }

  revokeAll(): void {
    for (const url of Object.values(this.thumbs())) URL.revokeObjectURL(url);
    for (const url of Object.values(this.originals())) URL.revokeObjectURL(url);
    this.thumbs.set({});
    this.originals.set({});
  }
}
