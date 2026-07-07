import { Injectable, computed, inject, signal } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { FsService } from '@core/fs/fs.service';
import { ImageReaderService } from '@core/images/image-reader.service';
import type { ImageRef, ImageRefGallery } from '@core/images/image-reader.types';
import type { NativeDirRef } from '@core/fs/native-fs.types';
import { getDirByPath, getOrCreateDirByPath, joinPath } from '@core/fs/walk';
import { WorkspaceService } from '@core/fs/workspace.service';
import { MigrationsService } from '@core/migrations/migrations.service';
import { nextPositionAfter, seedMissingPositions } from '@core/ordering/seed-positions';
import { positionSeedMigrationStep } from '@core/ordering/position.migration';
import { SearchIndexService } from '@core/search/search-index.service';
import type { SearchDoc } from '@core/search/search.types';
import { TagsService } from '@core/tags/tags.service';
import { toSlug, withSuffix } from '@shared/utils/slug';

import {
  GALLERY_META_FILE,
  GALLERY_SCHEMA_VERSION,
  IMAGES_DIR,
  IMAGE_KIND,
  ORIGINAL_DIR,
  THUMBS_DIR,
  THUMB_EXT,
  THUMB_MAX_DIM,
  THUMB_MIME,
  THUMB_QUALITY,
  extFromMime,
  type Gallery,
  type GalleryImage,
  type GallerySummary,
} from '../models/gallery.types';

const TRASH_DIR = '.mi-cerebro';
const TRASH_SUBDIR = 'trash';

interface GalleryLocation {
  readonly folder: string;
  readonly slug: string;
}

@Injectable({ providedIn: 'root' })
export class GalleriesService {
  private readonly fs = inject(FsService);
  private readonly workspace = inject(WorkspaceService);
  private readonly migrations = inject(MigrationsService);
  private readonly search = inject(SearchIndexService);
  private readonly tags = inject(TagsService);
  private readonly imageReader = inject(ImageReaderService);

  private readonly idToLoc = new Map<string, GalleryLocation>();
  private readonly summariesSignal = signal<readonly GallerySummary[]>([]);
  readonly summaries = this.summariesSignal.asReadonly();
  private readonly foldersSignal = signal<readonly string[]>([]);
  readonly folders = this.foldersSignal.asReadonly();
  readonly foldersSet = computed(() => new Set(this.foldersSignal()));

  constructor() {
    this.migrations.register({
      kind: IMAGE_KIND,
      latest: GALLERY_SCHEMA_VERSION,
      steps: [positionSeedMigrationStep(1)],
    });
  }

  async refresh(): Promise<readonly GallerySummary[]> {
    const root = await this.imagesDir();
    this.idToLoc.clear();
    this.imageReader.clear();
    const summaries: GallerySummary[] = [];
    const folders: string[] = [];
    const indexDocs: SearchDoc[] = [];
    const galleriesById = new Map<string, Gallery>();
    await this.walkGalleries(root, '', summaries, folders, indexDocs, galleriesById);
    summaries.sort(compareLegacy);
    const seeds = seedMissingPositions(summaries);
    if (seeds.length > 0) {
      const positionById = new Map(seeds.map((s) => [s.id, s.position] as const));
      for (const [id, pos] of positionById) {
        const gallery = galleriesById.get(id);
        if (gallery) await this.writePositionInPlace(gallery, pos);
      }
      for (let i = 0; i < summaries.length; i++) {
        const seeded = positionById.get(summaries[i]!.id);
        if (seeded) summaries[i] = { ...summaries[i]!, position: seeded };
      }
    }
    summaries.sort(comparePosition);
    this.summariesSignal.set(summaries);
    this.foldersSignal.set(folders);
    for (const doc of indexDocs) await this.search.upsert(doc);
    return summaries;
  }

  async createGallery(title = '', folder = ''): Promise<Gallery> {
    const root = await this.imagesDir();
    const parent = await getOrCreateDirByPath(this.fs, root, folder);
    const slug = await this.allocSlug(parent, title);
    const galleryDir = await this.fs.getOrCreateDir(parent, slug);
    await this.fs.getOrCreateDir(galleryDir, ORIGINAL_DIR);
    await this.fs.getOrCreateDir(galleryDir, THUMBS_DIR);
    const now = new Date().toISOString();
    const position = nextPositionAfter(lastPosition(this.summariesSignal()));
    const gallery: Gallery = {
      id: crypto.randomUUID(),
      title,
      tags: [],
      order: [],
      images: [],
      createdAt: now,
      updatedAt: now,
      schemaVersion: GALLERY_SCHEMA_VERSION,
      position,
    };
    await this.fs.writeFileAtomic(galleryDir, GALLERY_META_FILE, JSON.stringify(gallery, null, 2));
    this.idToLoc.set(gallery.id, { folder, slug });
    this.imageReader.register(gallery.id, folder, slug, this.toReaderGallery(gallery, folder));
    this.summariesSignal.update((curr) =>
      sortByPosition([...curr, this.toSummary(gallery, folder)]),
    );
    if (folder !== '' && !this.foldersSet().has(folder)) {
      this.foldersSignal.update((curr) => [...curr, folder]);
    }
    await this.search.upsert(this.toSearchDoc(gallery));
    return gallery;
  }

  async readGallery(id: string): Promise<Gallery> {
    const dir = await this.galleryDir(id);
    const raw = await this.fs.readJson<Gallery>(dir, GALLERY_META_FILE);
    return this.migrations.migrate<Gallery>(IMAGE_KIND, raw);
  }

  async saveGallery(gallery: Gallery): Promise<Gallery> {
    const dir = await this.galleryDir(gallery.id);
    const cleanTags = this.dropStaleTags(gallery.tags);
    const updated: Gallery = { ...gallery, tags: cleanTags, updatedAt: new Date().toISOString() };
    await this.fs.writeFileAtomic(dir, GALLERY_META_FILE, JSON.stringify(updated, null, 2));
    const loc = this.idToLoc.get(gallery.id);
    if (loc) {
      this.imageReader.register(
        gallery.id,
        loc.folder,
        loc.slug,
        this.toReaderGallery(updated, loc.folder),
      );
      this.summariesSignal.update((curr) =>
        sortByPosition(
          curr.map((s) => (s.id === gallery.id ? this.toSummary(updated, loc.folder) : s)),
        ),
      );
    }
    await this.search.upsert(this.toSearchDoc(updated));
    return updated;
  }

  async setPosition(id: string, position: string): Promise<void> {
    const gallery = await this.readGallery(id);
    const updated: Gallery = { ...gallery, position, updatedAt: new Date().toISOString() };
    const dir = await this.galleryDir(id);
    await this.fs.writeFileAtomic(dir, GALLERY_META_FILE, JSON.stringify(updated, null, 2));
    this.summariesSignal.update((curr) =>
      sortByPosition(curr.map((s) => (s.id === id ? { ...s, position } : s))),
    );
  }

  private async writePositionInPlace(gallery: Gallery, position: string): Promise<void> {
    const dir = await this.galleryDir(gallery.id);
    const seeded: Gallery = { ...gallery, position };
    await this.fs.writeFileAtomic(dir, GALLERY_META_FILE, JSON.stringify(seeded, null, 2));
  }

  async addImage(galleryId: string, blob: Blob, originalName: string): Promise<GalleryImage> {
    const gallery = await this.readGallery(galleryId);
    const dir = await this.galleryDir(galleryId);
    const mime = blob.type || guessMimeFromName(originalName) || 'application/octet-stream';
    const ext = extFromMime(mime, extFromName(originalName));
    const id = crypto.randomUUID();
    const originalDir = await this.fs.getOrCreateDir(dir, ORIGINAL_DIR);
    const thumbsDir = await this.fs.getOrCreateDir(dir, THUMBS_DIR);
    await this.fs.writeFileAtomicBinary(originalDir, `${id}.${ext}`, blob);
    const { width, height, thumbBlob } = await renderThumb(blob);
    if (thumbBlob) {
      await this.fs.writeFileAtomicBinary(thumbsDir, `${id}.${THUMB_EXT}`, thumbBlob);
    }
    const image: GalleryImage = {
      id,
      originalName,
      mime,
      ext,
      width,
      height,
      bytes: blob.size,
      addedAt: new Date().toISOString(),
    };
    const updated: Gallery = {
      ...gallery,
      images: [...gallery.images, image],
      order: [...gallery.order, id],
    };
    await this.saveGallery(updated);
    return image;
  }

  async readOriginalBlob(galleryId: string, imageId: string): Promise<Blob> {
    const gallery = await this.readGallery(galleryId);
    const meta = gallery.images.find((i) => i.id === imageId);
    if (!meta) throw new AppError(ERROR_CODES.FS_003, { severity: 'error', context: { imageId } });
    const dir = await this.galleryDir(galleryId);
    const originalDir = await this.fs.getOrCreateDir(dir, ORIGINAL_DIR);
    return this.fs.readFile(originalDir, `${imageId}.${meta.ext}`);
  }

  async readThumbBlob(galleryId: string, imageId: string): Promise<Blob | null> {
    const dir = await this.galleryDir(galleryId);
    const thumbsDir = await this.fs.getOrCreateDir(dir, THUMBS_DIR);
    if (!(await this.fs.hasEntry(thumbsDir, `${imageId}.${THUMB_EXT}`))) return null;
    return this.fs.readFile(thumbsDir, `${imageId}.${THUMB_EXT}`);
  }

  async removeImage(galleryId: string, imageId: string): Promise<void> {
    const gallery = await this.readGallery(galleryId);
    const meta = gallery.images.find((i) => i.id === imageId);
    if (!meta) return;
    const dir = await this.galleryDir(galleryId);
    const originalDir = await this.fs.getOrCreateDir(dir, ORIGINAL_DIR);
    const thumbsDir = await this.fs.getOrCreateDir(dir, THUMBS_DIR);
    try {
      await this.fs.removeEntry(originalDir, `${imageId}.${meta.ext}`);
    } catch {
      /* already gone */
    }
    try {
      await this.fs.removeEntry(thumbsDir, `${imageId}.${THUMB_EXT}`);
    } catch {
      /* already gone or never had thumb */
    }
    const updated: Gallery = {
      ...gallery,
      images: gallery.images.filter((i) => i.id !== imageId),
      order: gallery.order.filter((id) => id !== imageId),
    };
    await this.saveGallery(updated);
  }

  async reorderImages(galleryId: string, order: readonly string[]): Promise<void> {
    const gallery = await this.readGallery(galleryId);
    await this.saveGallery({ ...gallery, order });
  }

  async deleteGalleryToTrash(id: string): Promise<void> {
    const root = this.requireRoot();
    const loc = this.requireLoc(id);
    const parent = await this.getFolderDir(loc.folder);
    if (!parent) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    const srcDir = await this.fs.getDir(parent, loc.slug);
    if (!srcDir) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    const trash = await this.trashDir(root);
    const destName = `${IMAGE_KIND}__${id}__${loc.slug}`;
    const destDir = await this.fs.getOrCreateDir(trash, destName);
    await moveGalleryDir(this.fs, srcDir, destDir);
    try {
      await this.fs.removeEntry(parent, loc.slug, { recursive: true });
    } catch {
      /* already gone */
    }
    this.idToLoc.delete(id);
    this.imageReader.unregister(id);
    this.summariesSignal.update((curr) => curr.filter((s) => s.id !== id));
    await this.search.remove(id);
  }

  async restoreFromDir(trashDayDir: NativeDirRef, entryName: string): Promise<void> {
    const srcDir = await this.fs.getDir(trashDayDir, entryName);
    if (!srcDir) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    const gallery = await this.fs.readJson<Gallery>(srcDir, GALLERY_META_FILE);
    const root = await this.imagesDir();
    const slug = await this.allocSlug(root, gallery.title);
    const destDir = await this.fs.getOrCreateDir(root, slug);
    await moveGalleryDir(this.fs, srcDir, destDir);
    try {
      await this.fs.removeEntry(trashDayDir, entryName, { recursive: true });
    } catch {
      /* already gone */
    }
    await this.refresh();
  }

  async moveGalleryToFolder(id: string, newFolder: string): Promise<void> {
    const loc = this.requireLoc(id);
    if (loc.folder === newFolder) return;
    const root = await this.imagesDir();
    const srcParent = await this.getFolderDir(loc.folder);
    if (!srcParent) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    const destParent = await getOrCreateDirByPath(this.fs, root, newFolder);
    const destSlug = await this.allocAvailableDir(destParent, loc.slug);
    const srcDir = await this.fs.getDir(srcParent, loc.slug);
    if (!srcDir) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    const destDir = await this.fs.getOrCreateDir(destParent, destSlug);
    await moveGalleryDir(this.fs, srcDir, destDir);
    try {
      await this.fs.removeEntry(srcParent, loc.slug, { recursive: true });
    } catch {
      /* already gone */
    }
    this.idToLoc.set(id, { folder: newFolder, slug: destSlug });
    const moved = this.imageReader.getGallery(id);
    if (moved) {
      this.imageReader.register(id, newFolder, destSlug, { ...moved, folder: newFolder });
    }
    this.summariesSignal.update((curr) =>
      sortByPosition(curr.map((s) => (s.id === id ? { ...s, folder: newFolder } : s))),
    );
    if (newFolder !== '' && !this.foldersSet().has(newFolder)) {
      this.foldersSignal.update((curr) => [...curr, newFolder]);
    }
  }

  private async walkGalleries(
    dir: NativeDirRef,
    folder: string,
    summaries: GallerySummary[],
    folders: string[],
    indexDocs: SearchDoc[],
    galleriesById: Map<string, Gallery>,
  ): Promise<void> {
    for await (const name of this.fs.listSubdirs(dir)) {
      const sub = await this.fs.getDir(dir, name);
      if (!sub) continue;
      if (await this.fs.hasEntry(sub, GALLERY_META_FILE)) {
        try {
          const raw = await this.fs.readJson<Gallery>(sub, GALLERY_META_FILE);
          const gallery = await this.migrations.migrate<Gallery>(IMAGE_KIND, raw);
          this.idToLoc.set(gallery.id, { folder, slug: name });
          galleriesById.set(gallery.id, gallery);
          this.imageReader.register(
            gallery.id,
            folder,
            name,
            this.toReaderGallery(gallery, folder),
          );
          summaries.push(this.toSummary(gallery, folder));
          indexDocs.push(this.toSearchDoc(gallery));
        } catch (cause) {
          console.warn('[images] skipped gallery', name, cause);
        }
      } else {
        const path = joinPath(folder, name);
        folders.push(path);
        await this.walkGalleries(sub, path, summaries, folders, indexDocs, galleriesById);
      }
    }
  }

  private requireRoot(): NativeDirRef {
    const root = this.workspace.root();
    if (!root) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    return root;
  }

  private requireLoc(id: string): GalleryLocation {
    const loc = this.idToLoc.get(id);
    if (!loc) throw new AppError(ERROR_CODES.FS_003, { severity: 'error', context: { id } });
    return loc;
  }

  private async imagesDir(): Promise<NativeDirRef> {
    return this.fs.getOrCreateDir(this.requireRoot(), IMAGES_DIR);
  }

  private async getFolderDir(folder: string): Promise<NativeDirRef | null> {
    const root = await this.imagesDir();
    return getDirByPath(this.fs, root, folder);
  }

  private async galleryDir(id: string): Promise<NativeDirRef> {
    const loc = this.requireLoc(id);
    const parent = await this.getFolderDir(loc.folder);
    if (!parent) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    const dir = await this.fs.getDir(parent, loc.slug);
    if (!dir) throw new AppError(ERROR_CODES.FS_003, { severity: 'error' });
    return dir;
  }

  private async trashDir(root: NativeDirRef): Promise<NativeDirRef> {
    const meta = await this.fs.getOrCreateDir(root, TRASH_DIR);
    const trash = await this.fs.getOrCreateDir(meta, TRASH_SUBDIR);
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
    let cursor = trash;
    for (const part of today.split('/')) {
      cursor = await this.fs.getOrCreateDir(cursor, part);
    }
    return cursor;
  }

  private async allocSlug(dir: NativeDirRef, title: string): Promise<string> {
    const base = toSlug(title, 'galeria');
    for (let n = 1; n < 1000; n++) {
      const candidate = withSuffix(base, n);
      if (!(await this.fs.hasEntry(dir, candidate))) return candidate;
    }
    throw new AppError(ERROR_CODES.FS_001, { severity: 'error', context: { base } });
  }

  private async allocAvailableDir(dir: NativeDirRef, name: string): Promise<string> {
    if (!(await this.fs.hasEntry(dir, name))) return name;
    for (let n = 1; n < 1000; n++) {
      const candidate = `${name}-${n}`;
      if (!(await this.fs.hasEntry(dir, candidate))) return candidate;
    }
    throw new AppError(ERROR_CODES.FS_001, { severity: 'error' });
  }

  private toSummary(gallery: Gallery, folder: string): GallerySummary {
    return {
      id: gallery.id,
      title: gallery.title,
      updatedAt: gallery.updatedAt,
      tags: gallery.tags,
      folder,
      imageCount: gallery.images.length,
      position: gallery.position ?? '',
      coverImageIds: pickCoverIds(gallery),
    };
  }

  private toReaderGallery(gallery: Gallery, folder: string): ImageRefGallery {
    const images: ImageRef[] = gallery.images.map((i) => ({
      id: i.id,
      originalName: i.originalName,
      mime: i.mime,
      ext: i.ext,
    }));
    return { id: gallery.id, title: gallery.title, folder, images };
  }

  private toSearchDoc(gallery: Gallery): SearchDoc {
    const tagIds = this.dropStaleTags(gallery.tags);
    const tagLabels = tagIds
      .map((id) => this.tags.byId(id)?.label ?? '')
      .filter((l) => l !== '')
      .join(' ');
    return {
      id: gallery.id,
      kind: IMAGE_KIND,
      title: gallery.title,
      body: tagLabels,
      tagIds,
    };
  }

  private dropStaleTags(tagIds: readonly string[]): readonly string[] {
    if (tagIds.length === 0) return tagIds;
    return tagIds.filter((id) => this.tags.byId(id) !== undefined);
  }
}

const pickCoverIds = (gallery: Gallery): readonly string[] => {
  const known = new Set(gallery.images.map((i) => i.id));
  const picks: string[] = [];
  for (const id of gallery.order) {
    if (known.has(id) && !picks.includes(id)) picks.push(id);
    if (picks.length === 4) return picks;
  }
  for (const img of gallery.images) {
    if (!picks.includes(img.id)) picks.push(img.id);
    if (picks.length === 4) return picks;
  }
  return picks;
};

const compareLegacy = (a: GallerySummary, b: GallerySummary): number =>
  b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);

const comparePosition = (a: GallerySummary, b: GallerySummary): number => {
  if (a.position === '' && b.position === '') return compareLegacy(a, b);
  if (a.position === '') return 1;
  if (b.position === '') return -1;
  return a.position < b.position ? -1 : a.position > b.position ? 1 : 0;
};

const sortByPosition = (list: readonly GallerySummary[]): GallerySummary[] =>
  [...list].sort(comparePosition);

const lastPosition = (list: readonly GallerySummary[]): string | null => {
  let max: string | null = null;
  for (const s of list) {
    if (s.position !== '' && (max === null || s.position > max)) max = s.position;
  }
  return max;
};

const moveGalleryDir = async (
  fs: FsService,
  src: NativeDirRef,
  dest: NativeDirRef,
): Promise<void> => {
  for await (const filename of fs.listFiles(src)) {
    await fs.moveFile(src, filename, dest, filename);
  }
  for await (const sub of fs.listSubdirs(src)) {
    const subSrc = await fs.getDir(src, sub);
    if (!subSrc) continue;
    const subDest = await fs.getOrCreateDir(dest, sub);
    await moveGalleryDir(fs, subSrc, subDest);
  }
};

const guessMimeFromName = (name: string): string => {
  const dot = name.lastIndexOf('.');
  if (dot < 0) return '';
  const ext = name.slice(dot + 1).toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'avif') return 'image/avif';
  if (ext === 'svg') return 'image/svg+xml';
  if (ext === 'bmp') return 'image/bmp';
  return '';
};

const extFromName = (name: string): string => {
  const dot = name.lastIndexOf('.');
  if (dot < 0) return 'bin';
  return name.slice(dot + 1).toLowerCase();
};

interface RenderedThumb {
  readonly width: number;
  readonly height: number;
  readonly thumbBlob: Blob | null;
}

// why: SVG and exotic codecs may fail in createImageBitmap; we still want to
//      record the image (sin thumb) y dejar que la UI caiga al original.
const renderThumb = async (blob: Blob): Promise<RenderedThumb> => {
  try {
    const bitmap = await createImageBitmap(blob);
    const width = bitmap.width;
    const height = bitmap.height;
    const longest = Math.max(width, height);
    const scale = longest > THUMB_MAX_DIM ? THUMB_MAX_DIM / longest : 1;
    const tw = Math.max(1, Math.round(width * scale));
    const th = Math.max(1, Math.round(height * scale));
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(tw, th);
      const ctx = canvas.getContext('2d');
      if (!ctx) return { width, height, thumbBlob: null };
      ctx.drawImage(bitmap, 0, 0, tw, th);
      bitmap.close();
      const thumbBlob = await canvas.convertToBlob({ type: THUMB_MIME, quality: THUMB_QUALITY });
      return { width, height, thumbBlob };
    }
    bitmap.close();
    return { width, height, thumbBlob: null };
  } catch (cause) {
    console.warn('[images] thumb render failed', cause);
    return { width: 0, height: 0, thumbBlob: null };
  }
};
