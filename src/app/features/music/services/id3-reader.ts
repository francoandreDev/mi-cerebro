// why: jsmediatags' package.json `browser` field points to dist/jsmediatags.js
//      (does not exist in the published tarball — only dist/jsmediatags.min.js
//      is shipped). Vite/esbuild fail to resolve the bare specifier, so import
//      the UMD bundle by explicit path.
import jsmediatags from 'jsmediatags/dist/jsmediatags.min.js';
import type { PictureType, TagType } from 'jsmediatags/types';

// why: jsmediatags is callback-based. We wrap it once and return only the
//      fields we actually persist on Track (see [[project-music-redesign]]).
//      Failures resolve to null so the caller treats the track as "metadata
//      not probed" instead of throwing — the UI honestly shows "Sin álbum"
//      rather than guessed values.

export interface Id3Result {
  readonly title?: string;
  readonly artist?: string;
  readonly album?: string;
  readonly albumArtist?: string;
  readonly year?: number;
  readonly trackNumber?: number;
  readonly discNumber?: number;
  readonly genre?: string;
  readonly lyrics?: string;
  readonly picture?: { readonly blob: Blob; readonly mime: string };
}

export const readId3 = (file: Blob): Promise<Id3Result | null> =>
  new Promise((resolve) => {
    try {
      jsmediatags.read(file, {
        onSuccess: (data) => resolve(toResult(data)),
        onError: (err) => {
          console.warn('[music] id3 read failed', err);
          resolve(null);
        },
      });
    } catch (cause) {
      console.warn('[music] id3 read threw', cause);
      resolve(null);
    }
  });

const toResult = (data: TagType): Id3Result => {
  const tags = data.tags;
  return {
    ...stringField('title', tags.title),
    ...stringField('artist', tags.artist),
    ...stringField('album', tags.album),
    ...stringField('genre', tags.genre),
    ...stringField('albumArtist', readTextFrame(tags, 'TPE2') ?? undefined),
    ...numberField('year', parseYear(tags.year)),
    ...numberField('trackNumber', parseFirstInt(tags.track)),
    ...numberField('discNumber', parseFirstInt(readTextFrame(tags, 'TPOS') ?? undefined)),
    ...stringField('lyrics', readLyricsFrame(tags) ?? undefined),
    ...(pictureToBlob(tags.picture) ? { picture: pictureToBlob(tags.picture)! } : {}),
  };
};

const stringField = <K extends string>(
  key: K,
  raw: string | undefined,
): Partial<Record<K, string>> =>
  typeof raw === 'string' && raw.trim() ? ({ [key]: raw.trim() } as Record<K, string>) : {};

const numberField = <K extends string>(key: K, value: number | null): Partial<Record<K, number>> =>
  value !== null ? ({ [key]: value } as Record<K, number>) : {};

export const trackFieldsFromId3 = (
  id3: Id3Result | null,
  coverPath: string | null,
): Partial<Id3Result & { coverPath: string }> => {
  if (!id3 && !coverPath) return {};
  return {
    ...(id3?.title ? { title: id3.title } : {}),
    ...(id3?.artist ? { artist: id3.artist } : {}),
    ...(id3?.album ? { album: id3.album } : {}),
    ...(id3?.albumArtist ? { albumArtist: id3.albumArtist } : {}),
    ...(id3?.year !== undefined ? { year: id3.year } : {}),
    ...(id3?.trackNumber !== undefined ? { trackNumber: id3.trackNumber } : {}),
    ...(id3?.discNumber !== undefined ? { discNumber: id3.discNumber } : {}),
    ...(id3?.genre ? { genre: id3.genre } : {}),
    ...(id3?.lyrics ? { lyrics: id3.lyrics } : {}),
    ...(coverPath ? { coverPath } : {}),
  };
};

const parseYear = (raw: string | undefined): number | null => {
  if (!raw) return null;
  const match = /\d{4}/.exec(raw);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
};

const parseFirstInt = (raw: string | undefined): number | null => {
  if (!raw) return null;
  const match = /\d+/.exec(raw);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const readTextFrame = (tags: TagType['tags'], frameId: string): string | null => {
  const frame = tags[frameId];
  if (!frame || typeof frame !== 'object') return null;
  const data = (frame as { data?: unknown }).data;
  if (typeof data === 'string' && data.trim()) return data.trim();
  if (data && typeof data === 'object' && 'text' in data) {
    const text = (data as { text?: unknown }).text;
    if (typeof text === 'string' && text.trim()) return text.trim();
  }
  return null;
};

// why: jsmediatags' shipped .d.ts types tags.lyrics as `string`, but the
//      USLT frame reader actually resolves it to `{ language, descriptor,
//      lyrics }` — the type declaration doesn't match the runtime shape.
const readLyricsFrame = (tags: TagType['tags']): string | null => {
  const frame = tags.lyrics as unknown;
  if (typeof frame === 'string') return frame.trim() || null;
  if (frame && typeof frame === 'object' && 'lyrics' in frame) {
    const lyrics = (frame as { lyrics?: unknown }).lyrics;
    if (typeof lyrics === 'string' && lyrics.trim()) return lyrics.trim();
  }
  return null;
};

const pictureToBlob = (picture: PictureType | undefined): { blob: Blob; mime: string } | null => {
  if (!picture || !Array.isArray(picture.data) || picture.data.length === 0) return null;
  const mime = picture.format || 'image/jpeg';
  const bytes = new Uint8Array(picture.data);
  return { blob: new Blob([bytes], { type: mime }), mime };
};
