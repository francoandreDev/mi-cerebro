import type { MigrationStep } from '@core/migrations/migration.types';

// why: v1→v2 just bumps schemaVersion and ensures `tracks` exists. The new
//      optional ID3 fields (title/artist/album/coverPath/...) default to
//      undefined for legacy tracks and get backfilled lazily by the library
//      service on refresh (see [[project-music-redesign]]).
export const musicLibraryV2MigrationStep = (from: number): MigrationStep => ({
  from,
  to: from + 1,
  run: (d) => ({
    ...d,
    schemaVersion: from + 1,
    tracks: Array.isArray(d['tracks']) ? (d['tracks'] as unknown[]) : [],
  }),
});

// why: v2→v3 adds `tags: string[]` to every track (§ shortcuts-cross-section,
//      tags on Track/Playlist). Legacy tracks default to an empty array —
//      never invented tags, honest empty state.
export const musicLibraryV3MigrationStep = (from: number): MigrationStep => ({
  from,
  to: from + 1,
  run: (d) => ({
    ...d,
    schemaVersion: from + 1,
    tracks: (Array.isArray(d['tracks']) ? (d['tracks'] as Record<string, unknown>[]) : []).map(
      (t) => ({ ...t, tags: Array.isArray(t['tags']) ? t['tags'] : [] }),
    ),
  }),
});
