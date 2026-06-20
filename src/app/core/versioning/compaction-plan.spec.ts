import { describe, expect, it } from 'vitest';

import { buildCompactionPlan, isBarrier } from './compaction-plan';
import type { CommitSummary } from './versioning.service';

const NOW = Date.UTC(2026, 5, 20, 12, 0, 0); // 2026-06-20T12:00:00Z
const DAY = 86_400_000;

interface MakeCommit {
  readonly oid: string;
  readonly daysAgo: number;
  readonly message?: string;
}

function c({ oid, daysAgo, message }: MakeCommit): CommitSummary {
  return {
    oid,
    message: message ?? 'auto: test commit',
    authorTimestamp: NOW - daysAgo * DAY,
    parents: [],
  };
}

describe('isBarrier', () => {
  it('flags tagged oids', () => {
    const commit = c({ oid: 'abc', daysAgo: 20 });
    expect(isBarrier(commit, new Set(['abc']))).toBe(true);
  });

  it('flags before-restore commits', () => {
    const commit = c({
      oid: 'abc',
      daysAgo: 20,
      message: 'before-restore: snapshot antes de restaurar deadbeef',
    });
    expect(isBarrier(commit, new Set())).toBe(true);
  });

  it('flags commits with Merge-Group trailer', () => {
    const commit = c({
      oid: 'abc',
      daysAgo: 20,
      message:
        'merge: principal ← borrador-1\n\nMerge-Group: 11111111-1111-1111-1111-111111111111\nMerge-From: borrador-1\nMerge-Into: principal\nMerge-Choice: from\n',
    });
    expect(isBarrier(commit, new Set())).toBe(true);
  });

  it('does not flag plain autocommits', () => {
    const commit = c({ oid: 'abc', daysAgo: 20, message: 'auto: 3 notes (2026-05-30) [timer]' });
    expect(isBarrier(commit, new Set())).toBe(false);
  });

  it('does not match Merge-Group as substring of the subject line', () => {
    const commit = c({ oid: 'abc', daysAgo: 20, message: 'fix Merge-Group rendering bug' });
    expect(isBarrier(commit, new Set())).toBe(false);
  });
});

describe('buildCompactionPlan', () => {
  it('returns empty plan for empty input', () => {
    const plan = buildCompactionPlan({ commits: [], tagOids: new Set(), now: NOW });
    expect(plan.fuseGroups).toEqual([]);
    expect(plan.preservedOids).toEqual([]);
  });

  it('preserves all commits within the 7-day window untouched', () => {
    const commits = [
      c({ oid: 'a', daysAgo: 0 }),
      c({ oid: 'b', daysAgo: 3 }),
      c({ oid: 'c', daysAgo: 7 }),
    ];
    const plan = buildCompactionPlan({ commits, tagOids: new Set(), now: NOW });
    expect(plan.fuseGroups).toEqual([]);
    expect([...plan.preservedOids].sort()).toEqual(['a', 'b', 'c']);
  });

  it('fuses ≥2 daily commits in the 8-30d window into one group', () => {
    const commits = [
      c({ oid: 'a', daysAgo: 14 }),
      c({ oid: 'b', daysAgo: 14 }),
      c({ oid: 'd', daysAgo: 14 }),
    ];
    const plan = buildCompactionPlan({ commits, tagOids: new Set(), now: NOW });
    expect(plan.fuseGroups).toHaveLength(1);
    expect(plan.fuseGroups[0]!.bucket).toBe('daily');
    expect(plan.fuseGroups[0]!.bucketKey).toBe('2026-06-06');
    expect(plan.fuseGroups[0]!.oids).toEqual(['d', 'b', 'a']); // oldest → newest
    expect(plan.preservedOids).toEqual([]);
  });

  it('preserves a singleton bucket instead of "fusing" 1 commit', () => {
    const commits = [c({ oid: 'a', daysAgo: 14 })];
    const plan = buildCompactionPlan({ commits, tagOids: new Set(), now: NOW });
    expect(plan.fuseGroups).toEqual([]);
    expect(plan.preservedOids).toEqual(['a']);
  });

  it('splits a daily bucket around a tag barrier', () => {
    // All on day 2026-06-06 (14 days ago), tag in the middle.
    const commits = [
      c({ oid: 'newer-1', daysAgo: 14 }),
      c({ oid: 'newer-2', daysAgo: 14 }),
      c({ oid: 'tag', daysAgo: 14 }),
      c({ oid: 'older-1', daysAgo: 14 }),
      c({ oid: 'older-2', daysAgo: 14 }),
    ];
    const plan = buildCompactionPlan({ commits, tagOids: new Set(['tag']), now: NOW });
    expect(plan.fuseGroups).toHaveLength(2);
    expect(plan.fuseGroups[0]!.oids).toEqual(['older-2', 'older-1']);
    expect(plan.fuseGroups[1]!.oids).toEqual(['newer-2', 'newer-1']);
    expect(plan.preservedOids).toEqual(['tag']);
  });

  it('preserves before-restore commits and splits their bucket', () => {
    const commits = [
      c({ oid: 'after', daysAgo: 14 }),
      c({
        oid: 'br',
        daysAgo: 14,
        message: 'before-restore: snapshot antes de restaurar cafebabe',
      }),
      c({ oid: 'before-1', daysAgo: 14 }),
      c({ oid: 'before-2', daysAgo: 14 }),
    ];
    const plan = buildCompactionPlan({ commits, tagOids: new Set(), now: NOW });
    expect(plan.fuseGroups).toHaveLength(1);
    expect(plan.fuseGroups[0]!.oids).toEqual(['before-2', 'before-1']);
    expect(plan.preservedOids).toEqual(['br', 'after']);
  });

  it('preserves Merge-Group commits even when they sit inside a bucket', () => {
    const mergeMsg =
      'merge: principal ← borrador\n\nMerge-Group: 22222222-2222-2222-2222-222222222222\nMerge-From: borrador\nMerge-Into: principal\nMerge-Choice: from\n';
    const commits = [
      c({ oid: 'a', daysAgo: 14 }),
      c({ oid: 'mg', daysAgo: 14, message: mergeMsg }),
      c({ oid: 'b', daysAgo: 14 }),
      c({ oid: 'd', daysAgo: 14 }),
    ];
    const plan = buildCompactionPlan({ commits, tagOids: new Set(), now: NOW });
    expect(plan.preservedOids).toContain('mg');
    expect(plan.fuseGroups).toHaveLength(1);
    expect(plan.fuseGroups[0]!.oids).toEqual(['d', 'b']);
  });

  it('groups by ISO week in the 31-180d window', () => {
    // 60 days ago = 2026-04-21 (Tue, ISO week 17 of 2026).
    // 61 days ago = 2026-04-20 (Mon, same ISO week).
    // 67 days ago = 2026-04-14 (Tue, ISO week 16).
    const commits = [
      c({ oid: 'w17a', daysAgo: 60 }),
      c({ oid: 'w17b', daysAgo: 61 }),
      c({ oid: 'w16a', daysAgo: 67 }),
      c({ oid: 'w16b', daysAgo: 68 }),
    ];
    const plan = buildCompactionPlan({ commits, tagOids: new Set(), now: NOW });
    expect(plan.fuseGroups).toHaveLength(2);
    const keys = plan.fuseGroups.map((g) => g.bucketKey).sort();
    expect(keys).toEqual(['2026-W16', '2026-W17']);
    expect(plan.fuseGroups.every((g) => g.bucket === 'weekly')).toBe(true);
  });

  it('groups by calendar month past 180 days', () => {
    // 200 days ago = 2025-12-02; 210 days ago = 2025-11-22.
    const commits = [
      c({ oid: 'dec-a', daysAgo: 200 }),
      c({ oid: 'dec-b', daysAgo: 201 }),
      c({ oid: 'nov-a', daysAgo: 210 }),
      c({ oid: 'nov-b', daysAgo: 211 }),
    ];
    const plan = buildCompactionPlan({ commits, tagOids: new Set(), now: NOW });
    expect(plan.fuseGroups).toHaveLength(2);
    const keys = plan.fuseGroups.map((g) => g.bucketKey).sort();
    expect(keys).toEqual(['2025-11', '2025-12']);
    expect(plan.fuseGroups.every((g) => g.bucket === 'monthly')).toBe(true);
  });

  it('handles a mixed log with all 3 buckets, barriers, and recent commits', () => {
    const commits = [
      c({ oid: 'r1', daysAgo: 1 }), // recent
      c({ oid: 'r2', daysAgo: 6 }), // recent
      c({ oid: 'd1', daysAgo: 10 }), // daily 2026-06-10
      c({ oid: 'd2', daysAgo: 10 }), // daily 2026-06-10
      c({ oid: 'tag', daysAgo: 25 }), // barrier in daily window
      c({ oid: 'd3', daysAgo: 25 }), // daily 2026-05-26
      c({ oid: 'd4', daysAgo: 25 }), // daily 2026-05-26
      c({ oid: 'w1', daysAgo: 90 }), // weekly
      c({ oid: 'w2', daysAgo: 90 }), // weekly (same week)
      c({ oid: 'm1', daysAgo: 200 }), // monthly
      c({ oid: 'm2', daysAgo: 200 }), // monthly (same month)
    ];
    const plan = buildCompactionPlan({ commits, tagOids: new Set(['tag']), now: NOW });
    expect([...plan.preservedOids].sort()).toEqual(['r1', 'r2', 'tag']);
    const buckets = plan.fuseGroups.map((g) => g.bucket).sort();
    expect(buckets).toEqual(['daily', 'daily', 'monthly', 'weekly']);
  });

  it('does not merge across different bucket keys even if the bucket type matches', () => {
    const commits = [
      c({ oid: 'a', daysAgo: 10 }), // 2026-06-10
      c({ oid: 'b', daysAgo: 11 }), // 2026-06-09
      c({ oid: 'd', daysAgo: 11 }), // 2026-06-09
    ];
    const plan = buildCompactionPlan({ commits, tagOids: new Set(), now: NOW });
    // 'a' alone on its day → preserved; 'b' + 'd' fuse.
    expect(plan.preservedOids).toEqual(['a']);
    expect(plan.fuseGroups).toHaveLength(1);
    expect(plan.fuseGroups[0]!.bucketKey).toBe('2026-06-09');
    expect(plan.fuseGroups[0]!.oids).toEqual(['d', 'b']);
  });

  it('captures the newest timestamp of each fuse group', () => {
    const commits = [
      c({ oid: 'newer', daysAgo: 14 }), // newer of the day
      c({ oid: 'older', daysAgo: 14 }), // same day, both 14d ago
    ];
    const plan = buildCompactionPlan({ commits, tagOids: new Set(), now: NOW });
    expect(plan.fuseGroups).toHaveLength(1);
    expect(plan.fuseGroups[0]!.newestTimestamp).toBe(NOW - 14 * DAY);
  });
});
