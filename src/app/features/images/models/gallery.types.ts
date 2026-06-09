export const GALLERY_SCHEMA_VERSION = 1;
export const IMAGE_KIND = 'image';
export const IMAGES_DIR = 'images';
export const GALLERY_META_FILE = '_gallery.json';
export const ORIGINAL_DIR = 'original';
export const THUMBS_DIR = 'thumbs';
export const THUMB_EXT = 'webp';
export const THUMB_MIME = 'image/webp';
export const THUMB_MAX_DIM = 320;
export const THUMB_QUALITY = 0.8;

export interface GalleryImage {
  readonly id: string;
  readonly originalName: string;
  readonly mime: string;
  readonly ext: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  readonly addedAt: string;
}

export interface Gallery {
  readonly id: string;
  readonly title: string;
  readonly tags: readonly string[];
  readonly order: readonly string[];
  readonly images: readonly GalleryImage[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly schemaVersion: number;
  readonly [key: string]: unknown;
}

export interface GallerySummary {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
  readonly tags: readonly string[];
  readonly folder: string;
  readonly imageCount: number;
}

export const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
};

export const extFromMime = (mime: string, fallback = 'bin'): string =>
  MIME_TO_EXT[mime.toLowerCase()] ?? fallback;
