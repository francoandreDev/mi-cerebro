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

// why: shared by the age-bucketed scheduler plan and the user-picked date
//      range plan (see buildRangeCompactionPlan below) — both walk the same
//      barrier-respecting oldest→newest loop, only "is this commit eligible
//      at all" and "which group key does it fall into" differ.
interface EligibilityPolicy {
  isEligible(commit: CommitSummary, now: number): boolean;
  groupFor(commit: CommitSummary, now: number): { bucket: FuseBucket; key: string };
}

function buildPlanWithPolicy(
  input: CompactionPlanInput,
  policy: EligibilityPolicy,
): CompactionPlan {
  // Process oldest → newest so contiguous same-group runs are obvious.
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
    if (!policy.isEligible(commit, input.now)) {
      flush();
      preservedOids.push(commit.oid);
      continue;
    }
    if (isBarrier(commit, input.tagOids)) {
      flush();
      preservedOids.push(commit.oid);
      continue;
    }
    const { bucket, key } = policy.groupFor(commit, input.now);
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

export function buildCompactionPlan(input: CompactionPlanInput): CompactionPlan {
  return buildPlanWithPolicy(input, {
    isEligible: (commit, now) => now - commit.authorTimestamp > 7 * DAY_MS,
    groupFor: (commit) => {
      const ageMs = input.now - commit.authorTimestamp;
      const bucket = classifyBucket(ageMs);
      return { bucket, key: bucketKey(bucket, commit.authorTimestamp) };
    },
  });
}

export interface RangeCompactionPlanInput {
  readonly commits: readonly CommitSummary[];
  readonly tagOids: ReadonlySet<string>;
  // why: manual override (§12 "Compactación manual sobre rango específico")
  //      — the 7-day recency floor and daily/weekly/monthly bucketing are
  //      the scheduler's defaults, not hard invariants. The user is picking
  //      a deliberate window (e.g. "flatten last month's noise"), so every
  //      non-barrier commit inside [fromMs, toMs] fuses into ONE group
  //      instead of being split by day/week/month — barriers (tags,
  //      before-restore, Merge-Group) are still never fused, same as the
  //      scheduler's plan.
  readonly fromMs: number;
  readonly toMs: number;
}

export function buildRangeCompactionPlan(input: RangeCompactionPlanInput): CompactionPlan {
  const key = `range:${input.fromMs}-${input.toMs}`;
  return buildPlanWithPolicy(
    { commits: input.commits, tagOids: input.tagOids, now: input.toMs },
    {
      isEligible: (commit) =>
        commit.authorTimestamp >= input.fromMs && commit.authorTimestamp <= input.toMs,
      groupFor: () => ({ bucket: 'daily', key }),
    },
  );
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
