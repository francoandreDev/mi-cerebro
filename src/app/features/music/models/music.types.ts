export const MUSIC_DIR = 'music';
export const TRACKS_DIR = 'tracks';
export const PLAYLISTS_DIR = 'playlists';
export const LIBRARY_FILE = '_library.json';
export const PLAYLIST_FILE_SUFFIX = '.json';
export const TRACK_EXT = '.mp3';
export const TRACK_MIME = 'audio/mpeg';

export interface Track {
  readonly id: string;
  readonly originalName: string;
  readonly addedAt: string;
  readonly bytes: number;
  readonly durationMs: number | null;
}

export interface MusicLibrary {
  readonly tracks: readonly Track[];
}

export interface Playlist {
  readonly id: string;
  readonly title: string;
  readonly trackIds: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PlaylistSummary {
  readonly id: string;
  readonly title: string;
  readonly trackCount: number;
  readonly updatedAt: string;
}
