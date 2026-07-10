import { Injectable } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';

// why: opt-in fallback for tracks with no embedded ID3 lyrics (see
// id3-reader.ts). Never called automatically — the user explicitly looks it
// up per track because artist/title guessed from a messy filename is
// unreliable and results are unverified. Results aren't persisted to
// Track/library JSON, only kept in-memory by the caller for the current
// session, so a bad match never gets written to disk as if it were real
// metadata.
//
// lyrics.ovh does a direct artist+title lookup (no free-text search, no list
// of candidates) — verified working (DNS resolves, CORS allows reading the
// response body from the app's origin, 404 on no match) before wiring this
// in, since the previous provider (lrclib.org) turned out to have gone dark
// (NXDOMAIN) mid-implementation.
const LYRICS_OVH_BASE = 'https://api.lyrics.ovh/v1';

interface LyricsOvhResponse {
  readonly lyrics?: string;
  readonly error?: string;
}

@Injectable({ providedIn: 'root' })
export class LyricsLookupService {
  async lookup(artist: string, title: string): Promise<string | null> {
    const a = artist.trim();
    const t = title.trim();
    if (!a || !t) return null;
    const url = `${LYRICS_OVH_BASE}/${encodeURIComponent(a)}/${encodeURIComponent(t)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new AppError(ERROR_CODES.MUS_005, { severity: 'warning', recoverable: true });
    }
    const data = (await res.json()) as LyricsOvhResponse;
    const lyrics = data.lyrics?.trim();
    return lyrics ? lyrics : null;
  }
}
