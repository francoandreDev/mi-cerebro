// §12 — persisted state for the background compaction pass. Lives at
// `.mi-cerebro/compaction-state.json` so the 1×/day throttle survives
// reloads and the next session honors it. Per-workspace, not per-branch:
// the threshold check is per-branch but the pass-level throttle is global.

import type { FsService } from '@core/fs/fs.service';
import type { NativeDirRef } from '@core/fs/native-fs.types';

export const COMPACTION_STATE_SCHEMA_VERSION = 1 as const;
const META_DIR = '.mi-cerebro';
const STATE_FILE = 'compaction-state.json';

export interface CompactionState {
  readonly schemaVersion: typeof COMPACTION_STATE_SCHEMA_VERSION;
  readonly lastRunAt: number | null;
}

export const EMPTY_COMPACTION_STATE: CompactionState = {
  schemaVersion: COMPACTION_STATE_SCHEMA_VERSION,
  lastRunAt: null,
};

export async function readCompactionState(
  fs: FsService,
  root: NativeDirRef,
): Promise<CompactionState> {
  try {
    const dir = await fs.getOrCreateDir(root, META_DIR);
    const raw = await fs.readJson<Partial<CompactionState>>(dir, STATE_FILE);
    if (raw.schemaVersion !== COMPACTION_STATE_SCHEMA_VERSION) return EMPTY_COMPACTION_STATE;
    return {
      schemaVersion: COMPACTION_STATE_SCHEMA_VERSION,
      lastRunAt: typeof raw.lastRunAt === 'number' ? raw.lastRunAt : null,
    };
  } catch {
    return EMPTY_COMPACTION_STATE;
  }
}

export async function writeCompactionState(
  fs: FsService,
  root: NativeDirRef,
  state: CompactionState,
): Promise<void> {
  const dir = await fs.getOrCreateDir(root, META_DIR);
  await fs.writeFileAtomic(dir, STATE_FILE, JSON.stringify(state, null, 2));
}
