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
