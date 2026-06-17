// Reads commits from VersioningService, derives quick kind chips
// from the autocommit message convention, and groups them into the
// temporal buckets the design (§12 "Historial") asks for.

import { Injectable, computed, inject, signal } from '@angular/core';

import { MilestoneService } from '@core/versioning/milestone.service';
import { VariantsService } from '@core/versioning/variants.service';
import { stripHeadsPrefix } from '@core/versioning/variants.io';
import { PRINCIPAL_VARIANT_ID, type Variant } from '@core/versioning/variants.types';
import { VersioningService } from '@core/versioning/versioning.service';

import type {
  BucketId,
  CommitBucket,
  CommitEntry,
  MergeGroupInfo,
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
  private readonly versioning = inject(VersioningService);
  private readonly milestoneService = inject(MilestoneService);
  private readonly variants = inject(VariantsService);
  private readonly entriesSignal = signal<readonly CommitEntry[]>([]);
  private readonly milestonesSignal = signal<readonly MilestoneEntry[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly originByOidSignal = signal<ReadonlyMap<string, string>>(new Map());
  private readonly variantsByIdSignal = signal<ReadonlyMap<string, Variant>>(new Map());

  readonly entries = this.entriesSignal.asReadonly();
  readonly milestones = this.milestonesSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  // why: oid → variantId map built BFS-from-principal over family refs. First
  //      writer wins so original authors (parents) keep credit for OIDs that
  //      siblings inherit via merge. Used by /history to color each commit
  //      row by its variant of origin.
  readonly originByOid = this.originByOidSignal.asReadonly();
  readonly variantsById = this.variantsByIdSignal.asReadonly();
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
      // why: walk main + comments + draft of the active variant so faceta
      //      commits (`auto [borrador]:`, `merge [comentarios]:`, etc.)
      //      surface in /history. Without this, git.log defaults to HEAD
      //      and only main commits show up.
      const active = this.variants.getActive();
      const refs = active
        ? [active.refs.main, active.refs.comments, active.refs.draft].map(stripHeadsPrefix)
        : undefined;
      const summaries = await this.versioning.log(depth, refs);
      const entries = summaries.map((s): CommitEntry => {
        const message = s.message.trim();
        return {
          oid: s.oid,
          shortOid: s.oid.slice(0, 7),
          message,
          date: new Date(s.authorTimestamp),
          kinds: parseKindsFromMessage(message),
          mergeGroup: parseMergeGroup(message),
        };
      });
      this.entriesSignal.set(entries);
      const milestones = await this.milestoneService.list();
      this.milestonesSignal.set(milestones);
      await this.rebuildOriginMap(depth);
    } catch (e) {
      this.errorSignal.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.loadingSignal.set(false);
    }
  }

  // why: walk every variant's family refs in BFS-from-principal order so the
  //      original author of each OID claims it before any descendant that
  //      inherits the OID via merge. The active variant is walked last among
  //      its tier so siblings that authored the commit keep credit.
  private async rebuildOriginMap(depth: number): Promise<void> {
    const variants = await this.variants.list();
    const byId = new Map<string, Variant>();
    for (const v of variants) byId.set(v.id, v);
    this.variantsByIdSignal.set(byId);
    const order = orderByLineage(variants);
    const origin = new Map<string, string>();
    for (const v of order) {
      const refs = [v.refs.main, v.refs.comments, v.refs.draft].map(stripHeadsPrefix);
      let oids: readonly string[] = [];
      try {
        const summaries = await this.versioning.log(depth, refs);
        oids = summaries.map((s) => s.oid);
      } catch {
        // ref may not exist yet; skip
      }
      for (const oid of oids) {
        if (!origin.has(oid)) origin.set(oid, v.id);
      }
    }
    this.originByOidSignal.set(origin);
  }

  async refreshMilestones(): Promise<void> {
    const milestones = await this.milestoneService.list();
    this.milestonesSignal.set(milestones);
  }
}

// Variants ordered principal-first then by lineage depth (parents before
// children). Equal-depth tied by id for determinism. Used to walk refs so
// the original author of an OID claims it before any descendant inherits it
// via merge.
function orderByLineage(variants: readonly Variant[]): readonly Variant[] {
  const depth = new Map<string, number>();
  const compute = (v: Variant): number => {
    const cached = depth.get(v.id);
    if (cached !== undefined) return cached;
    if (v.id === PRINCIPAL_VARIANT_ID || !v.parentId) {
      depth.set(v.id, 0);
      return 0;
    }
    const parent = variants.find((p) => p.id === v.parentId);
    const d = parent ? compute(parent) + 1 : 1;
    depth.set(v.id, d);
    return d;
  };
  return [...variants].sort((a, b) => {
    const da = compute(a);
    const db = compute(b);
    if (da !== db) return da - db;
    return a.id.localeCompare(b.id);
  });
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

// Trailer format written by MergeService.formatMessage:
//   merge: <path> (from "<fromName>" into "<intoName>")
//
//   Merge-Group: <uuid>
//   Merge-From: <id>
//   Merge-Into: <id>
//   Merge-Choice: <choice>
function parseMergeGroup(message: string): MergeGroupInfo | null {
  const idMatch = /^Merge-Group:\s*(\S+)/m.exec(message);
  if (!idMatch) return null;
  const subjectMatch = /from "([^"]+)" into "([^"]+)"/.exec(message);
  return {
    id: idMatch[1]!,
    fromName: subjectMatch?.[1] ?? null,
    intoName: subjectMatch?.[2] ?? null,
  };
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
