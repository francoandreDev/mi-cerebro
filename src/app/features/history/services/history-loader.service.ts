// Fetch layer for /history. Splits "obtener" from "mostrar" (§13 redesign
// v2 fase 1): `loadWindow` is a resolution-parametric window fetch that
// callers use to hydrate what the current zoom level needs (aggregate for
// panorámica, summary for estratos, detail for cordel). The BFS-per-variant
// origin map used to be tied to first paint and dominated TTI as history
// grew; now it runs off the critical path via `ensureOriginMap`, so the
// timeline paints as soon as the summary window resolves and commit color
// fades in when the map lands.

import { Injectable, inject, signal } from '@angular/core';

import { MilestoneService } from '@core/versioning/milestone.service';
import { stripHeadsPrefix } from '@core/versioning/variants.io';
import { PRINCIPAL_VARIANT_ID, type Variant } from '@core/versioning/variants.types';
import { VariantsService } from '@core/versioning/variants.service';
import { VersioningService } from '@core/versioning/versioning.service';

import { facetOf, type Facet } from './facet';
import type { CommitEntry, MergeGroupInfo, MilestoneEntry } from './history.types';

export type Resolution = 'aggregate' | 'summary' | 'detail';
// why: `loadWindow` only makes sense for the window-scoped resolutions.
//      Detail resolution is per-oid hydration handled by HistoryDiffService,
//      so we narrow the type here instead of guarding at runtime.
export type WindowResolution = Exclude<Resolution, 'detail'>;

export interface LoadWindowOptions {
  readonly resolution: WindowResolution;
  readonly depth?: number;
  readonly refs?: readonly string[];
  readonly since?: Date;
  readonly until?: Date;
}

export interface DayAggregate {
  readonly dayStart: number;
  readonly count: number;
  readonly byFacet: Readonly<Record<Facet, number>>;
}

export interface LoadWindowResult {
  readonly resolution: WindowResolution;
  readonly commits: readonly CommitEntry[];
  readonly aggregate: readonly DayAggregate[];
}

const DEFAULT_SUMMARY_DEPTH = 200;
const DEFAULT_AGGREGATE_DEPTH = 1000;

@Injectable()
export class HistoryLoader {
  private readonly versioning = inject(VersioningService);
  private readonly milestoneService = inject(MilestoneService);
  private readonly variants = inject(VariantsService);

  private readonly originByOidSignal = signal<ReadonlyMap<string, string>>(new Map());
  private readonly variantsByIdSignal = signal<ReadonlyMap<string, Variant>>(new Map());
  // why: exposed as signals so consumers repaint when the async BFS lands.
  //      Before Fase 1 the container awaited the BFS synchronously in load();
  //      now it treats the map as "may fill in later" and CSS/facet fallback
  //      covers the gap until it does.
  readonly originByOid = this.originByOidSignal.asReadonly();
  readonly variantsById = this.variantsByIdSignal.asReadonly();

  private originPromise: Promise<void> | null = null;
  private originDepth = 0;

  activeRefs(): readonly string[] | undefined {
    const active = this.variants.getActive();
    if (!active) return undefined;
    return [active.refs.main, active.refs.comments, active.refs.draft].map(stripHeadsPrefix);
  }

  async loadWindow(opts: LoadWindowOptions): Promise<LoadWindowResult> {
    const refs = opts.refs ?? this.activeRefs();
    const depth =
      opts.depth ??
      (opts.resolution === 'aggregate' ? DEFAULT_AGGREGATE_DEPTH : DEFAULT_SUMMARY_DEPTH);
    const summaries = await this.versioning.log(depth, refs);
    const sinceMs = opts.since?.getTime();
    const untilMs = opts.until?.getTime();
    const commits: CommitEntry[] = [];
    for (const s of summaries) {
      if (sinceMs !== undefined && s.authorTimestamp < sinceMs) continue;
      if (untilMs !== undefined && s.authorTimestamp > untilMs) continue;
      const message = s.message.trim();
      commits.push({
        oid: s.oid,
        shortOid: s.oid.slice(0, 7),
        message,
        date: new Date(s.authorTimestamp),
        kinds: parseKindsFromMessage(message),
        mergeGroup: parseMergeGroup(message),
      });
    }
    const aggregate = opts.resolution === 'aggregate' ? aggregateByDay(commits) : [];
    return { resolution: opts.resolution, commits, aggregate };
  }

  async loadMilestones(): Promise<readonly MilestoneEntry[]> {
    return this.milestoneService.list();
  }

  // why: coalesces concurrent callers and never re-runs the walk unless a
  //      deeper window is asked for. The promise is memoized on the instance
  //      so a page mount that fires load() twice (route re-entry, StrictMode)
  //      shares one BFS pass.
  ensureOriginMap(depth: number): Promise<void> {
    if (this.originPromise && depth <= this.originDepth) return this.originPromise;
    this.originDepth = Math.max(this.originDepth, depth);
    this.originPromise = this.rebuildOriginMap(this.originDepth).catch((e) => {
      // reset so a later call retries; swallow so callers can void-fire.
      this.originPromise = null;
      throw e;
    });
    return this.originPromise;
  }

  // Force a fresh walk (e.g. after variant create/delete or restore that
  // changed refs). Discards the memoized promise.
  invalidateOriginMap(): void {
    this.originPromise = null;
    this.originDepth = 0;
  }

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

// Autocommit messages look like: "auto: 3 notes, 1 task (date) [reason]".
// Extract the kind words ("notes", "task", …) for chip rendering.
// Manual / restore / merge commits don't match and get no chips.
export function parseKindsFromMessage(msg: string): readonly string[] {
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
export function parseMergeGroup(message: string): MergeGroupInfo | null {
  const idMatch = /^Merge-Group:\s*(\S+)/m.exec(message);
  if (!idMatch) return null;
  const subjectMatch = /from "([^"]+)" into "([^"]+)"/.exec(message);
  return {
    id: idMatch[1]!,
    fromName: subjectMatch?.[1] ?? null,
    intoName: subjectMatch?.[2] ?? null,
  };
}

// why: builds a day-bucketed histogram of commit density + faceta mix from
//      an already-fetched summary list. Cheap to compute; the fetch is the
//      cost, and this consumer just re-projects it. Used by future panorama
//      rendering; exposed now to lock the loadWindow contract.
function aggregateByDay(commits: readonly CommitEntry[]): readonly DayAggregate[] {
  const map = new Map<number, { count: number; byFacet: Record<Facet, number> }>();
  for (const c of commits) {
    const day = startOfDay(c.date.getTime());
    const cur = map.get(day) ?? { count: 0, byFacet: { main: 0, comments: 0, draft: 0 } };
    cur.count += 1;
    cur.byFacet[facetOf(c.message)] += 1;
    map.set(day, cur);
  }
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([dayStart, v]) => ({ dayStart, count: v.count, byFacet: v.byFacet }));
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
