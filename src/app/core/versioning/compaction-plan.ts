// docs/proyecto/features.md §12 "Compactación del historial" — pure planner.
//
// Takes a chronological commit log of a single branch + the set of oids
// that have tags pointing to them, and returns the groups of commits to
// fuse and the oids to preserve verbatim. Barriers (tags,
// `before-restore:` commits, `Merge-Group:` bundles) split buckets;
// commits ≤7d old are always preserved.
//
// No FS, no isomorphic-git. Session 2 wires this into the actual
// rewrite plumbing.

import type { CommitSummary } from './versioning.service';

export type FuseBucket = 'daily' | 'weekly' | 'monthly';

export interface FuseGroup {
  readonly bucket: FuseBucket;
  readonly bucketKey: string; // YYYY-MM-DD | YYYY-Www | YYYY-MM (UTC)
  readonly oids: readonly string[]; // oldest → newest
  readonly newestTimestamp: number; // ms epoch
  // why: presente sólo cuando el grupo termina exactamente en un milestone
  //      recién marcado (planner milestone-compaction). Cuando está, el
  //      commit fusionado usa este slug como subject en vez del formato
  //      `auto-batch [...]`. Ver §12 "Disparo por milestone".
  readonly label?: string;
}

export interface CompactionPlan {
  readonly fuseGroups: readonly FuseGroup[];
  readonly preservedOids: readonly string[];
}

export interface CompactionPlanInput {
  // Newest-first, as returned by `git.log` / VersioningService.log.
  readonly commits: readonly CommitSummary[];
  // Oids that any annotated tag (milestone) points to.
  readonly tagOids: ReadonlySet<string>;
  // Current time in ms. Injected so the planner is deterministic in tests.
  readonly now: number;
}

const DAY_MS = 86_400_000;

// Barrier = a commit the planner must never fuse. The 3 cases per §12:
// tag (milestone), `before-restore:` prefix (Restore's reversibility
// promise), and `Merge-Group:` trailer (the 3 facet commits of a merge
// session are sacred together — v1 keeps them all preserved, fusing
// the bundle as a unit is left for a later iteration).
export function isBarrier(commit: CommitSummary, tagOids: ReadonlySet<string>): boolean {
  if (tagOids.has(commit.oid)) return true;
  if (commit.message.startsWith('before-restore:')) return true;
  if (/^Merge-Group:/m.test(commit.message)) return true;
  return false;
}

export function buildCompactionPlan(input: CompactionPlanInput): CompactionPlan {
  // Process oldest → newest so contiguous same-bucket runs are obvious.
  const ordered = [...input.commits].reverse();
  const fuseGroups: FuseGroup[] = [];
  const preservedOids: string[] = [];

  let pending: {
    bucket: FuseBucket;
    key: string;
    oids: string[];
    newest: number;
  } | null = null;

  const flush = (): void => {
    if (!pending) return;
    // why: a "group" of 1 commit is not worth a rewrite — preserve it
    //      as-is. Keeps the plan honest about what work it will do.
    if (pending.oids.length < 2) {
      preservedOids.push(...pending.oids);
    } else {
      fuseGroups.push({
        bucket: pending.bucket,
        bucketKey: pending.key,
        oids: [...pending.oids],
        newestTimestamp: pending.newest,
      });
    }
    pending = null;
  };

  for (const commit of ordered) {
    const ageMs = input.now - commit.authorTimestamp;
    if (ageMs <= 7 * DAY_MS) {
      flush();
      preservedOids.push(commit.oid);
      continue;
    }
    if (isBarrier(commit, input.tagOids)) {
      flush();
      preservedOids.push(commit.oid);
      continue;
    }
    const bucket = classifyBucket(ageMs);
    const key = bucketKey(bucket, commit.authorTimestamp);
    if (pending && pending.bucket === bucket && pending.key === key) {
      pending.oids.push(commit.oid);
      if (commit.authorTimestamp > pending.newest) pending.newest = commit.authorTimestamp;
    } else {
      flush();
      pending = { bucket, key, oids: [commit.oid], newest: commit.authorTimestamp };
    }
  }
  flush();

  return { fuseGroups, preservedOids };
}

function classifyBucket(ageMs: number): FuseBucket {
  if (ageMs <= 30 * DAY_MS) return 'daily';
  if (ageMs <= 180 * DAY_MS) return 'weekly';
  return 'monthly';
}

function bucketKey(bucket: FuseBucket, ts: number): string {
  if (bucket === 'daily') return dayKey(ts);
  if (bucket === 'weekly') return isoWeekKey(ts);
  return monthKey(ts);
}

function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function monthKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 7);
}

// ISO 8601 week (Mon-Sun, week with Thursday Jan 4 = W01).
function isoWeekKey(ts: number): string {
  const d = new Date(ts);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = Date.UTC(target.getUTCFullYear(), 0, 4);
  const firstThursdayDate = new Date(firstThursday);
  const firstDayNr = (firstThursdayDate.getUTCDay() + 6) % 7;
  const weekStart = firstThursday - firstDayNr * DAY_MS;
  const week = Math.round((target.getTime() - weekStart) / (7 * DAY_MS)) + 1;
  return `${target.getUTCFullYear()}-W${week.toString().padStart(2, '0')}`;
}
