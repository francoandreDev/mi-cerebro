import type { Track } from '../models/music.types';

export interface AlbumGroup {
  readonly key: string;
  readonly album: string | null;
  readonly artist: string | null;
  readonly year: number | null;
  readonly coverPath: string | null;
  readonly tracks: readonly Track[];
}

const NO_ALBUM_KEY = '__no_album__';

export function groupTracksByAlbum(tracks: readonly Track[]): readonly AlbumGroup[] {
  const buckets = new Map<string, Track[]>();
  for (const t of tracks) {
    const key = t.album !== undefined && t.album.length > 0 ? albumKey(t) : NO_ALBUM_KEY;
    let arr = buckets.get(key);
    if (!arr) {
      arr = [];
      buckets.set(key, arr);
    }
    arr.push(t);
  }

  const groups: AlbumGroup[] = [];
  for (const [key, items] of buckets) {
    if (key === NO_ALBUM_KEY) continue;
    const head = items[0];
    if (!head) continue;
    groups.push({
      key,
      album: head.album ?? null,
      artist: head.albumArtist ?? head.artist ?? null,
      year: head.year ?? null,
      coverPath: items.find((t) => t.coverPath !== undefined)?.coverPath ?? null,
      tracks: [...items].sort(orderedTrackComparator),
    });
  }

  groups.sort((a, b) => {
    const ar = (a.artist ?? '').localeCompare(b.artist ?? '', undefined, { sensitivity: 'base' });
    if (ar !== 0) return ar;
    const ya = a.year ?? Number.POSITIVE_INFINITY;
    const yb = b.year ?? Number.POSITIVE_INFINITY;
    if (ya !== yb) return ya - yb;
    return (a.album ?? '').localeCompare(b.album ?? '', undefined, { sensitivity: 'base' });
  });

  const noAlbum = buckets.get(NO_ALBUM_KEY);
  if (noAlbum && noAlbum.length > 0) {
    groups.push({
      key: NO_ALBUM_KEY,
      album: null,
      artist: null,
      year: null,
      coverPath: null,
      tracks: [...noAlbum].sort((a, b) => a.originalName.localeCompare(b.originalName)),
    });
  }

  return groups;
}

function albumKey(t: Track): string {
  const artist = t.albumArtist ?? t.artist ?? '';
  return `${artist.toLowerCase()}::${(t.album ?? '').toLowerCase()}::${t.year ?? ''}`;
}

function orderedTrackComparator(a: Track, b: Track): number {
  const da = a.discNumber ?? 1;
  const db = b.discNumber ?? 1;
  if (da !== db) return da - db;
  const ta = a.trackNumber ?? Number.POSITIVE_INFINITY;
  const tb = b.trackNumber ?? Number.POSITIVE_INFINITY;
  if (ta !== tb) return ta - tb;
  return a.originalName.localeCompare(b.originalName);
}
