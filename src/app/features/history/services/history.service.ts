// Presentation layer over HistoryLoader: turns the fetched summary window
// into the bucketed / collapsed timeline the UI renders. Fetch, milestones
// and origin-map hydration live in HistoryLoader (§13 redesign v2 fase 1);
// this file only re-projects what the loader exposes.

import { Injectable, computed, inject, signal } from '@angular/core';

import { ErrorService } from '@core/errors/error.service';

import { HistoryLoader } from './history-loader.service';
import type {
  BucketId,
  CommitBucket,
  CommitEntry,
  MilestoneEntry,
  TimelineItem,
} from './history.types';

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
  private readonly loader = inject(HistoryLoader);
  private readonly errors = inject(ErrorService);
  private readonly entriesSignal = signal<readonly CommitEntry[]>([]);
  private readonly milestonesSignal = signal<readonly MilestoneEntry[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly entries = this.entriesSignal.asReadonly();
  readonly milestones = this.milestonesSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  // why: oid → variantId map built BFS-from-principal over family refs. First
  //      writer wins so original authors (parents) keep credit for OIDs that
  //      siblings inherit via merge. Fase 1: BFS runs off the critical path
  //      (see HistoryLoader.ensureOriginMap); the signal fills asynchronously
  //      and the timeline repaints with commit color as it lands.
  readonly originByOid = this.loader.originByOid;
  readonly variantsById = this.loader.variantsById;
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
    return BUCKET_ORDER.map((id) => ({
      id,
      items: collapseAutoGroups(collapseMergeGroups(groups.get(id)!)),
    })).filter((b) => b.items.length > 0);
  });

  async load(depth = DEFAULT_DEPTH): Promise<void> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    try {
      // why: milestones + summary window paint the timeline. Origin BFS is
      //      O(refs × depth × variantes) and used to gate first paint; we
      //      fire it off the critical path so TTI drops from "walk all
      //      variants" to "walk active refs once". Refs invalidation on
      //      restore is handled by the caller via load()'s completion.
      this.loader.invalidateOriginMap();
      const [window, milestones] = await Promise.all([
        this.loader.loadWindow({ resolution: 'summary', depth }),
        this.loader.loadMilestones(),
      ]);
      this.entriesSignal.set(window.commits);
      this.milestonesSignal.set(milestones);
      void this.loader.ensureOriginMap(depth).catch(() => undefined);
    } catch (e) {
      this.errors.report(e);
      this.errorSignal.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.loadingSignal.set(false);
    }
  }

  async refreshMilestones(): Promise<void> {
    const milestones = await this.loader.loadMilestones();
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

// why: ráfagas de autocommits (mismo sujeto, separados por menos de una
//      hora) inflan el timeline. La huella mezcla faceta + sujeto base
//      (kinds sin contar para main; título para [comentarios]/[borrador])
//      así que `auto: 2 books` y `auto: 5 books` se funden, pero
//      `auto: 2 books, 1 note` no — el sujeto es distinto.
const AUTO_GROUP_WINDOW_MS = 60 * 60 * 1000;

export function autoFingerprint(message: string): string | null {
  const m = /^auto(?:\s+\[([^\]]+)\])?:\s*(.+?)\s*(?:\(|$)/.exec(message);
  if (!m) return null;
  const facet = m[1] ?? 'main';
  const body = m[2]!.trim();
  if (body === '') return null;
  if (facet === 'main') {
    const kinds = body
      .split(',')
      .map((p) => p.trim().replace(/^\d+\s+/, ''))
      .map((p) => singularize(p))
      .filter((p) => p !== '')
      .sort();
    if (kinds.length === 0) return null;
    return `main::${kinds.join(',')}`;
  }
  return `${facet}::${body}`;
}

function singularize(word: string): string {
  if (word.endsWith('s') && word.length > 1) return word.slice(0, -1);
  return word;
}

// why: agrupamos por fingerprint con ventana acotada al ancla (commit más
//      nuevo del grupo). Iteramos newest→oldest manteniendo un grupo
//      "abierto" por fingerprint; si llega un commit con el mismo fp y
//      su ts está a ≤ 1h del ancla, lo absorbe — sin importar qué otros
//      commits aparezcan en el medio. Cuando un commit cae fuera de la
//      ventana, abre un grupo nuevo (que reemplaza al abierto previo).
//      Los commits no auto y los de otros fingerprints conservan su
//      posición; el grupo se renderiza en la del ancla.
interface PendingAutoGroup {
  readonly fingerprint: string;
  readonly anchorTs: number;
  readonly anchorIndex: number;
  members: CommitEntry[];
}

function collapseAutoGroups(items: readonly TimelineItem[]): readonly TimelineItem[] {
  const open = new Map<string, PendingAutoGroup>();
  const groupByIndex = new Map<number, PendingAutoGroup>();
  items.forEach((item, idx) => {
    if (item.kind !== 'commit') return;
    const fp = autoFingerprint(item.entry.message);
    if (!fp) return;
    const ts = item.entry.date.getTime();
    const current = open.get(fp);
    if (current && current.anchorTs - ts <= AUTO_GROUP_WINDOW_MS) {
      current.members.push(item.entry);
      groupByIndex.set(idx, current);
      return;
    }
    const fresh: PendingAutoGroup = {
      fingerprint: fp,
      anchorTs: ts,
      anchorIndex: idx,
      members: [item.entry],
    };
    open.set(fp, fresh);
    groupByIndex.set(idx, fresh);
  });
  const out: TimelineItem[] = [];
  items.forEach((item, idx) => {
    const group = groupByIndex.get(idx);
    if (!group) {
      out.push(item);
      return;
    }
    if (idx !== group.anchorIndex) return;
    if (group.members.length < 2) {
      out.push(item);
      return;
    }
    out.push({
      kind: 'auto-group',
      id: `auto:${group.members[0]!.oid}`,
      fingerprint: group.fingerprint,
      latest: group.members[0]!,
      members: group.members,
    });
  });
  return out;
}

// why: VersioningService.log returns commits newest-first; merge group
//      members are emitted in commit-time order so within one bucket
//      they are contiguous. The first hit in iteration is the most
//      recent, which becomes the leader shown when collapsed.
function collapseMergeGroups(entries: readonly CommitEntry[]): readonly TimelineItem[] {
  const out: TimelineItem[] = [];
  let i = 0;
  while (i < entries.length) {
    const entry = entries[i]!;
    const group = entry.mergeGroup;
    if (!group) {
      out.push({ kind: 'commit', entry });
      i++;
      continue;
    }
    const members: CommitEntry[] = [entry];
    let j = i + 1;
    while (j < entries.length && entries[j]!.mergeGroup?.id === group.id) {
      members.push(entries[j]!);
      j++;
    }
    out.push({
      kind: 'merge-group',
      id: group.id,
      fromName: group.fromName,
      intoName: group.intoName,
      latest: entry,
      members,
    });
    i = j;
  }
  return out;
}
