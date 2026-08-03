export const MUSIC_DIR = 'music';
export const TRACKS_DIR = 'tracks';
export const COVERS_DIR = 'covers';
export const PLAYLISTS_DIR = 'playlists';
export const LIBRARY_FILE = '_library.json';
export const TRACK_META_FILE = 'meta.json';
export const PLAYLIST_FILE_SUFFIX = '.json';
export const TRACK_EXT = '.mp3';
export const TRACK_MIME = 'audio/mpeg';

export const MUSIC_LIBRARY_KIND = 'music-library';
export const MUSIC_LIBRARY_SCHEMA_VERSION = 3;
export const PLAYLIST_KIND = 'playlist';
export const PLAYLIST_SCHEMA_VERSION = 2;
export const TRACK_KIND = 'track';

// why: bump when a *new ID3 field* is added (like `lyrics`) so tracks probed
// under an older version get re-scanned once even though `metadataProbedAt`
// is already set. Independent from MUSIC_LIBRARY_SCHEMA_VERSION, which is
// about the JSON file's shape, not which ID3 fields were extracted.
export const MUSIC_METADATA_PROBE_VERSION = 2;

export interface Track {
  readonly id: string;
  readonly originalName: string;
  readonly addedAt: string;
  readonly bytes: number;
  readonly durationMs: number | null;
  readonly playCount?: number;
  readonly lastPlayedAt?: string;
  readonly title?: string;
  readonly artist?: string;
  readonly album?: string;
  readonly albumArtist?: string;
  readonly year?: number;
  readonly trackNumber?: number;
  readonly discNumber?: number;
  readonly genre?: string;
  readonly lyrics?: string;
  readonly coverPath?: string;
  readonly metadataProbedAt?: string;
  readonly metadataProbeVersion?: number;
  readonly tags: readonly string[];
}

export interface MusicLibrary {
  readonly schemaVersion: number;
  readonly tracks: readonly Track[];
  readonly [key: string]: unknown;
}

export interface Playlist {
  readonly schemaVersion: number;
  readonly id: string;
  readonly title: string;
  readonly trackIds: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly favorite?: boolean;
  readonly tags: readonly string[];
  readonly [key: string]: unknown;
}

export interface PlaylistSummary {
  readonly id: string;
  readonly title: string;
  readonly trackCount: number;
  readonly updatedAt: string;
  readonly favorite: boolean;
  readonly tags: readonly string[];
}
