export const FILE_COLLECTION_SCHEMA_VERSION = 1;
export const FILE_KIND = 'file';
export const FILES_DIR = 'files';
export const COLLECTION_META_FILE = '_collection.json';
export const ITEMS_DIR = 'items';

export interface FileItem {
  readonly id: string;
  readonly originalName: string;
  readonly mime: string;
  readonly ext: string;
  readonly bytes: number;
  readonly addedAt: string;
}

export interface FileCollection {
  readonly id: string;
  readonly title: string;
  readonly tags: readonly string[];
  readonly order: readonly string[];
  readonly items: readonly FileItem[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly schemaVersion: number;
  readonly [key: string]: unknown;
}

export interface FileCollectionSummary {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
  readonly tags: readonly string[];
  readonly folder: string;
  readonly itemCount: number;
}

export const extFromName = (name: string, fallback = 'bin'): string => {
  const dot = name.lastIndexOf('.');
  if (dot < 0) return fallback;
  const ext = name.slice(dot + 1).toLowerCase();
  return ext === '' ? fallback : ext;
};

import type { IconName } from '@shared/icon/icons.data';

// why: keep this list short — icon is purely a visual hint, not a content-type
//      registry. Anything unknown falls back to a generic paperclip.
export const iconForMime = (mime: string, name: string): IconName => {
  const m = (mime || '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('audio/')) return 'music-note';
  if (m.startsWith('video/')) return 'video-camera';
  if (m === 'application/pdf') return 'file-pdf';
  if (m.startsWith('text/') || m === 'application/json') return 'file-text';
  if (
    m === 'application/zip' ||
    m === 'application/x-7z-compressed' ||
    m === 'application/x-rar-compressed' ||
    m === 'application/gzip' ||
    m === 'application/x-tar'
  )
    return 'package';
  const ext = extFromName(name, '');
  if (ext === 'pdf') return 'file-pdf';
  if (ext === 'mp3' || ext === 'wav' || ext === 'ogg' || ext === 'm4a' || ext === 'flac')
    return 'music-note';
  if (ext === 'mp4' || ext === 'mov' || ext === 'mkv' || ext === 'webm' || ext === 'avi')
    return 'video-camera';
  if (ext === 'zip' || ext === '7z' || ext === 'rar' || ext === 'gz' || ext === 'tar')
    return 'package';
  if (ext === 'txt' || ext === 'md' || ext === 'csv' || ext === 'json' || ext === 'log')
    return 'file-text';
  return 'paperclip';
};

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};
