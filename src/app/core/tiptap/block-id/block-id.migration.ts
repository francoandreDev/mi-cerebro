import type { JSONContent } from '@tiptap/core';

import type { MigrationStep } from '@core/migrations/migration.types';

import { injectBlockIds } from './inject-block-ids';

// why: shared factory for the 13c v1→v2 step. Every entity whose body is
//      a TipTap doc needs ids backfilled at first read so anchored
//      comments can target existing content. Safe on payloads without a
//      body (Book metadata under BOOK_KIND, etc.) — schemaVersion is
//      bumped either way so the migration registry never re-runs.
export const blockIdMigrationStep = (from: number): MigrationStep => ({
  from,
  to: from + 1,
  run: (d) => {
    const body = (d as { body?: unknown }).body;
    if (body && typeof body === 'object' && (body as JSONContent).type === 'doc') {
      return { ...d, schemaVersion: from + 1, body: injectBlockIds(body as JSONContent) };
    }
    return { ...d, schemaVersion: from + 1 };
  },
});
