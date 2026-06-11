// Reads commits from VersioningService, derives quick kind chips
// from the autocommit message convention, and groups them into the
// temporal buckets the design (§12 "Historial") asks for.

import { Injectable, computed, inject, signal } from '@angular/core';

import { MilestoneService } from '@core/versioning/milestone.service';
import { VersioningService } from '@core/versioning/versioning.service';

import type { BucketId, CommitBucket, CommitEntry, MilestoneEntry } from './history.types';

const DEFAULT_DEPTH = 200;

const BUCKET_ORDER: readonly BucketId[] = [
  'today',
  'yesterday',
  'this-week',
  'last-week',
  'two-weeks',
  'one-month',
  'older',
];

@Injectable()
export class HistoryService {
  private readonly versioning = inject(VersioningService);
  private readonly milestoneService = inject(MilestoneService);
  private readonly entriesSignal = signal<readonly CommitEntry[]>([]);
  private readonly milestonesSignal = signal<readonly MilestoneEntry[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly entries = this.entriesSignal.asReadonly();
  readonly milestones = this.milestonesSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly milestonesByOid = computed<ReadonlyMap<string, readonly MilestoneEntry[]>>(() => {
    const map = new Map<string, MilestoneEntry[]>();
    for (const m of this.milestonesSignal()) {
      const arr = map.get(m.oid) ?? [];
      arr.push(m);
      map.set(m.oid, arr);
    }
    return map;
  });
  // why: with our model (commits always land on main, restore always
  //      produces a new commit on top) HEAD is by definition the most
  //      recent entry. UI marks it as "actual".
  readonly headOid = computed<string | null>(() => this.entriesSignal()[0]?.oid ?? null);

  readonly buckets = computed<readonly CommitBucket[]>(() => {
    const now = Date.now();
    const groups = new Map<BucketId, CommitEntry[]>();
    for (const id of BUCKET_ORDER) groups.set(id, []);
    for (const entry of this.entriesSignal()) {
      const id = bucketFor(entry.date.getTime(), now);
      groups.get(id)!.push(entry);
    }
    return BUCKET_ORDER.map((id) => ({ id, entries: groups.get(id)! })).filter(
      (b) => b.entries.length > 0,
    );
  });

  async load(depth = DEFAULT_DEPTH): Promise<void> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    try {
      const summaries = await this.versioning.log(depth);
      const entries = summaries.map((s): CommitEntry => {
        const message = s.message.trim();
        return {
          oid: s.oid,
          shortOid: s.oid.slice(0, 7),
          message,
          date: new Date(s.authorTimestamp),
          kinds: parseKindsFromMessage(message),
        };
      });
      this.entriesSignal.set(entries);
      const milestones = await this.milestoneService.list();
      this.milestonesSignal.set(milestones);
    } catch (e) {
      this.errorSignal.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.loadingSignal.set(false);
    }
  }

  async refreshMilestones(): Promise<void> {
    const milestones = await this.milestoneService.list();
    this.milestonesSignal.set(milestones);
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function bucketFor(ts: number, nowMs: number): BucketId {
  const today = startOfDay(nowMs);
  const days = Math.floor((today - startOfDay(ts)) / DAY_MS);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return 'this-week';
  if (days < 14) return 'last-week';
  if (days < 21) return 'two-weeks';
  if (days < 45) return 'one-month';
  return 'older';
}

// Autocommit messages look like: "auto: 3 notes, 1 task (date) [reason]".
// Extract the kind words ("notes", "task", …) for chip rendering.
// Manual / restore / merge commits don't match and get no chips.
function parseKindsFromMessage(msg: string): readonly string[] {
  const m = /^auto(?:\s+\[[^\]]+\])?:\s*([^()[\]]+)/.exec(msg);
  if (!m) return [];
  const body = m[1]!;
  const kinds = new Set<string>();
  for (const part of body.split(',')) {
    const word = /\d+\s+([a-zA-Z]+)/.exec(part.trim());
    if (word) kinds.add(singularize(word[1]!));
  }
  return [...kinds];
}

function singularize(word: string): string {
  if (word.endsWith('s') && word.length > 1) return word.slice(0, -1);
  return word;
}
