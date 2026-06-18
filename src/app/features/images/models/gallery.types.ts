export {
  GALLERY_META_FILE,
  IMAGES_DIR,
  ORIGINAL_DIR,
  THUMBS_DIR,
  THUMB_EXT,
} from '@core/images/image-paths';

export const GALLERY_SCHEMA_VERSION = 2;
export const IMAGE_KIND = 'image';
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
  readonly position?: string;
  readonly [key: string]: unknown;
}

export interface GallerySummary {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
  readonly tags: readonly string[];
  readonly folder: string;
  readonly imageCount: number;
  readonly position: string;
  readonly coverImageIds: readonly string[];
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
