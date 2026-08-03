import type { MigrationStep } from '@core/migrations/migration.types';

// why: v1→v2 adds `tags: string[]` to the playlist file. Playlists predate
//      `schemaVersion` entirely (the field didn't exist before this change),
//      so callers seed `schemaVersion ?? 1` before migrating — see
//      PlaylistsService.
export const playlistV2MigrationStep = (from: number): MigrationStep => ({
  from,
  to: from + 1,
  run: (d) => ({
    ...d,
    schemaVersion: from + 1,
    tags: Array.isArray(d['tags']) ? (d['tags'] as unknown[]) : [],
  }),
});
