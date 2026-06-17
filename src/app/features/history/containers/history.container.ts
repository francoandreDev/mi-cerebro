import type { OnInit } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

import { ErrorService } from '@core/errors/error.service';
import { I18nService } from '@core/i18n/i18n.service';
import { RestoreService } from '@core/versioning/restore.service';
import { IconComponent } from '@shared/icon/icon.component';
import { McDatePipe } from '@shared/pipes/mc-date.pipe';

import type { TranslationKey } from '@core/i18n/i18n.types';

import { BUCKET_LABEL_KEY } from '../services/bucket-labels';
import { HistoryDiffService } from '../services/diff.service';
import type { EntityDiff } from '../services/diff.service';
import type { AnchorChangeStatus, AnchorMode } from '../services/diff.utils';
import { ALL_FACETS, facetOf, type Facet } from '../services/facet';
import { HistoryService } from '../services/history.service';
import type {
  BucketId,
  CommitBucket,
  CommitEntry,
  MilestoneEntry,
  TimelineItem,
} from '../services/history.types';
import { MilestoneController } from '../services/milestone.controller';

type GroupKey = 'notes' | 'tasks' | 'books' | 'drafts' | 'comments' | 'meta' | 'other';
type EntityFeedRow =
  | { readonly kind: 'header'; readonly key: GroupKey; readonly id: string; readonly count: number }
  | { readonly kind: 'entity'; readonly diff: EntityDiff; readonly id: string };

const GROUP_ORDER: readonly GroupKey[] = [
  'notes',
  'tasks',
  'books',
  'drafts',
  'comments',
  'meta',
  'other',
];

interface ParsedQuery {
  readonly facet: Facet | null;
  readonly sinceMs: number | null;
  readonly sha: string | null;
  readonly text: readonly string[];
}

function parseSearchQuery(raw: string): ParsedQuery {
  const trimmed = raw.trim();
  if (!trimmed) return { facet: null, sinceMs: null, sha: null, text: [] };
  let facet: Facet | null = null;
  let sinceMs: number | null = null;
  let sha: string | null = null;
  const text: string[] = [];
  for (const tok of trimmed.split(/\s+/)) {
    const lc = tok.toLowerCase();
    const facetMatch = /^facet:(main|comments|draft)$/.exec(lc);
    if (facetMatch) {
      facet = facetMatch[1] as Facet;
      continue;
    }
    const sinceMatch = /^since:(\d+)([dhw])$/.exec(lc);
    if (sinceMatch) {
      const n = Number(sinceMatch[1]);
      const unit = sinceMatch[2];
      const ms = unit === 'h' ? n * 3_600_000 : unit === 'w' ? n * 604_800_000 : n * 86_400_000;
      sinceMs = Date.now() - ms;
      continue;
    }
    const shaMatch = /^(?:sha:)?([0-9a-f]{4,40})$/i.exec(tok);
    if (shaMatch) {
      sha = shaMatch[1]!.toLowerCase();
      continue;
    }
    text.push(lc);
  }
  return { facet, sinceMs, sha, text };
}

function matchesQuery(entry: CommitEntry, q: ParsedQuery): boolean {
  if (q.facet && facetOf(entry.message) !== q.facet) return false;
  if (q.sinceMs !== null && entry.date.getTime() < q.sinceMs) return false;
  if (q.sha && !entry.oid.toLowerCase().startsWith(q.sha)) return false;
  if (q.text.length > 0) {
    const haystack = entry.message.toLowerCase();
    for (const term of q.text) {
      if (!haystack.includes(term)) return false;
    }
  }
  return true;
}

function groupKeyForPath(path: string): GroupKey {
  if (path.startsWith('notes/')) return 'notes';
  if (path.startsWith('tasks/')) return 'tasks';
  if (path.startsWith('books/')) return 'books';
  if (path.startsWith('drafts/')) return 'drafts';
  if (path.startsWith('comments/')) return 'comments';
  if (path.startsWith('.mi-cerebro/')) return 'meta';
  return 'other';
}

@Component({
  selector: 'mc-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [HistoryService, HistoryDiffService, MilestoneController],
  imports: [McDatePipe, IconComponent, NgTemplateOutlet],
  templateUrl: './history.container.html',
  styleUrl: './history.container.css',
})
export class HistoryContainer implements OnInit {
  private readonly history = inject(HistoryService);
  private readonly diff = inject(HistoryDiffService);
  private readonly restore = inject(RestoreService);
  protected readonly milestones = inject(MilestoneController);
  private readonly errors = inject(ErrorService);
  protected readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);

  protected readonly loading = this.history.loading;
  protected readonly error = this.history.error;
  protected readonly entries = this.history.entries;
  protected readonly headOid = this.history.headOid;
  protected readonly milestonesByOid = this.history.milestonesByOid;
  private readonly originByOid = this.history.originByOid;
  private readonly variantsById = this.history.variantsById;

  // Color del borde-izq de cada commit según la variante en la que fue
  // autoreado. Cuando no podemos atribuirla (raro, refs faltantes), devolvemos
  // null y la regla CSS por faceta queda como fallback visual.
  protected commitOriginColor(oid: string): string | null {
    const id = this.originByOid().get(oid);
    if (!id) return null;
    return this.variantsById().get(id)?.color ?? null;
  }
  protected commitOriginName(oid: string): string | null {
    const id = this.originByOid().get(oid);
    if (!id) return null;
    return this.variantsById().get(id)?.name ?? id;
  }

  private readonly onlyMilestonesSignal = signal(false);
  protected readonly onlyMilestones = this.onlyMilestonesSignal.asReadonly();
  protected toggleOnlyMilestones(): void {
    this.onlyMilestonesSignal.update((v) => !v);
  }

  // Free-text search over the timeline. Tokens:
  //  - facet:main|comments|draft  → faceta filter (also AND'd with chips)
  //  - since:Nd                    → solo commits con date ≥ ahora − N días
  //  - sha o sha:abc1234           → match por shortOid
  //  - cualquier otro token        → substring case-insensitive en el mensaje
  protected readonly query = signal('');
  protected onQueryInput(ev: Event): void {
    this.query.set((ev.target as HTMLInputElement).value);
  }
  protected clearQuery(): void {
    this.query.set('');
  }
  private readonly parsedQuery = computed<ParsedQuery>(() => parseSearchQuery(this.query()));

  // Collapsing either pane gives the other one the full /history width.
  // State is ephemeral on purpose: leaving and re-entering /history
  // resets to "both expanded" so the user never lands on a confusing
  // half-hidden screen.
  private readonly timelineCollapsedSignal = signal(false);
  private readonly detailCollapsedSignal = signal(false);
  protected readonly timelineCollapsed = this.timelineCollapsedSignal.asReadonly();
  protected readonly detailCollapsed = this.detailCollapsedSignal.asReadonly();
  // why: collapsing one pane forces the other open so /history never
  //      ends up with both hidden.
  protected toggleTimeline(): void {
    const next = !this.timelineCollapsedSignal();
    if (next) this.detailCollapsedSignal.set(false);
    this.timelineCollapsedSignal.set(next);
  }
  protected toggleDetail(): void {
    const next = !this.detailCollapsedSignal();
    if (next) this.timelineCollapsedSignal.set(false);
    this.detailCollapsedSignal.set(next);
  }

  // Faceta filter: chips at the top of the timeline let the user collapse
  // by branch family (main / comentarios / borrador). Default is all-on.
  // The set is constrained never to be empty so the user can't accidentally
  // hide everything by toggling the last chip off.
  protected readonly allFacets = ALL_FACETS;
  private readonly enabledFacetsSignal = signal<ReadonlySet<Facet>>(new Set(ALL_FACETS));
  protected readonly enabledFacets = this.enabledFacetsSignal.asReadonly();
  protected isFacetEnabled(f: Facet): boolean {
    return this.enabledFacetsSignal().has(f);
  }
  protected facetLabelKey(f: Facet): `versioning.history.facet.${Facet}` {
    return `versioning.history.facet.${f}`;
  }
  protected toggleFacet(f: Facet): void {
    this.enabledFacetsSignal.update((s) => {
      const next = new Set(s);
      if (next.has(f)) {
        if (next.size === 1) return s;
        next.delete(f);
      } else {
        next.add(f);
      }
      return next;
    });
  }

  // Filter the timeline by the "only milestones" toggle and by the
  // enabled facetas (mutually combinable). Buckets with zero matching
  // entries are dropped so the empty-state shows instead of bare headers.
  // Merge groups are kept when any member matches.
  private readonly noiseOidsSignal = signal<ReadonlySet<string>>(new Set());

  protected readonly buckets = computed<readonly CommitBucket[]>(() => {
    const all = this.history.buckets();
    const onlyMile = this.onlyMilestonesSignal();
    const facets = this.enabledFacetsSignal();
    const byOid = this.milestonesByOid();
    const noise = this.noiseOidsSignal();
    const q = this.parsedQuery();
    const matches = (entry: CommitEntry): boolean => {
      // why: milestones nunca se ocultan aunque sean ruido — el usuario
      //      decidió marcarlos como puntos relevantes.
      if (noise.has(entry.oid) && !byOid.has(entry.oid)) return false;
      if (!facets.has(facetOf(entry.message))) return false;
      if (onlyMile && !byOid.has(entry.oid)) return false;
      if (!matchesQuery(entry, q)) return false;
      return true;
    };
    const transformItem = (item: TimelineItem): TimelineItem | null => {
      if (item.kind === 'commit') return matches(item.entry) ? item : null;
      const kept = item.members.filter(matches);
      if (kept.length === 0) return null;
      if (kept.length === item.members.length) return item;
      if (kept.length === 1) return { kind: 'commit', entry: kept[0]! };
      return { ...item, members: kept, latest: kept[0]! };
    };
    return all
      .map((b) => ({
        id: b.id,
        items: b.items.map(transformItem).filter((x): x is TimelineItem => x !== null),
      }))
      .filter((b) => b.items.length > 0);
  });

  private readonly expandedMergeGroupsSignal = signal<Set<string>>(new Set());
  protected isMergeGroupExpanded(id: string): boolean {
    return this.expandedMergeGroupsSignal().has(id);
  }
  protected toggleMergeGroup(id: string): void {
    this.expandedMergeGroupsSignal.update((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  private readonly expandedAutoGroupsSignal = signal<Set<string>>(new Set());
  protected isAutoGroupExpanded(id: string): boolean {
    return this.expandedAutoGroupsSignal().has(id);
  }
  protected toggleAutoGroup(id: string): void {
    this.expandedAutoGroupsSignal.update((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // why: el "asunto" del líder del grupo es el mensaje del último commit
  //      sin el "(N comentarios)" o "(2026-06-14 17:00) [reason]" final,
  //      que cambia commit a commit y por eso disminuye legibilidad.
  protected autoGroupSubject(message: string): string {
    const m = /^auto(\s+\[[^\]]+\])?:\s*(.+?)\s*(?:\(|$)/.exec(message);
    if (!m) return message;
    const facet = m[1] ?? '';
    const body = m[2]!.trim();
    return `auto${facet}: ${body}`;
  }

  protected milestonesFor(oid: string): readonly MilestoneEntry[] {
    return this.milestonesByOid().get(oid) ?? [];
  }

  private readonly selectedOidSignal = signal<string | null>(null);
  protected readonly selectedOid = this.selectedOidSignal.asReadonly();
  protected readonly selectedEntry = computed<CommitEntry | null>(() => {
    const oid = this.selectedOidSignal();
    if (!oid) return null;
    return this.entries().find((e) => e.oid === oid) ?? null;
  });

  // Split the commit message into its subject (first line) and trailer
  // block (the rest). The h3 only shows the subject so multi-line merge
  // messages don't crush together; trailers go into a collapsible
  // section below the header.
  protected readonly selectedSubject = computed<string>(() => {
    const m = this.selectedEntry()?.message ?? '';
    const idx = m.indexOf('\n');
    return idx === -1 ? m : m.slice(0, idx);
  });
  protected readonly selectedBody = computed<string>(() => {
    const m = this.selectedEntry()?.message ?? '';
    const idx = m.indexOf('\n');
    return idx === -1 ? '' : m.slice(idx + 1).trim();
  });

  private readonly entityDiffsSignal = signal<readonly EntityDiff[]>([]);
  private readonly diffLoadingSignal = signal(false);
  private readonly expandedPathSignal = signal<string | null>(null);
  protected readonly entityDiffs = this.entityDiffsSignal.asReadonly();
  protected readonly diffLoading = this.diffLoadingSignal.asReadonly();
  protected readonly expandedPath = this.expandedPathSignal.asReadonly();

  // Summary + group-by-type for the detail pane. Counters from entity status;
  // groups from the path's first segment so the user can scan "what was
  // touched" before drilling into individual files.
  private readonly groupByTypeSignal = signal(false);
  protected readonly groupByType = this.groupByTypeSignal.asReadonly();
  protected toggleGroupByType(): void {
    this.groupByTypeSignal.update((v) => !v);
  }
  protected readonly diffSummary = computed(() => {
    const diffs = this.entityDiffsSignal();
    let added = 0;
    let modified = 0;
    let deleted = 0;
    for (const d of diffs) {
      if (d.status === 'added') added++;
      else if (d.status === 'deleted') deleted++;
      else modified++;
    }
    return { total: diffs.length, added, modified, deleted };
  });
  protected readonly groupedDiffs = computed<
    readonly { key: GroupKey; items: readonly EntityDiff[] }[]
  >(() => {
    const diffs = this.entityDiffsSignal();
    const buckets = new Map<GroupKey, EntityDiff[]>();
    for (const d of diffs) {
      const key = groupKeyForPath(d.filepath);
      const arr = buckets.get(key) ?? [];
      arr.push(d);
      buckets.set(key, arr);
    }
    return GROUP_ORDER.filter((k) => buckets.has(k)).map((k) => ({
      key: k,
      items: buckets.get(k)!,
    }));
  });
  // why: flat list of "headers + entities" so the template iterates with a
  //      single @for and avoids duplicating the entity row markup. When
  //      groupByType is off we just emit entities back-to-back.
  protected readonly entityFeed = computed<readonly EntityFeedRow[]>(() => {
    if (!this.groupByTypeSignal()) {
      return this.entityDiffsSignal().map((d) => ({ kind: 'entity', diff: d, id: d.filepath }));
    }
    const rows: EntityFeedRow[] = [];
    for (const g of this.groupedDiffs()) {
      rows.push({ kind: 'header', key: g.key, id: `h:${g.key}`, count: g.items.length });
      for (const d of g.items) rows.push({ kind: 'entity', diff: d, id: d.filepath });
    }
    return rows;
  });
  protected groupLabelKey(k: GroupKey): TranslationKey {
    return `versioning.history.summary.group.${k}`;
  }

  constructor() {
    effect(() => {
      const oid = this.selectedOidSignal();
      this.entityDiffsSignal.set([]);
      this.expandedPathSignal.set(null);
      if (!oid) return;
      this.diffLoadingSignal.set(true);
      void this.diff
        .loadForCommit(oid)
        .then((diffs) => {
          if (this.selectedOidSignal() !== oid) return;
          this.entityDiffsSignal.set(diffs);
          const first = diffs[0];
          if (first) this.expandedPathSignal.set(first.filepath);
        })
        .catch((e: unknown) => this.errors.report(e))
        .finally(() => {
          if (this.selectedOidSignal() === oid) this.diffLoadingSignal.set(false);
        });
    });
  }

  ngOnInit(): void {
    void this.reloadAll(true);
  }

  // why: el sondeo de "ruido" debe re-ejecutarse después de cada load(),
  //      incluidos los que disparan los restore. Si el primer commit del
  //      bucket es ruido, salto al siguiente visible para no abrir vacío.
  private async reloadAll(selectFirst: boolean): Promise<void> {
    await this.history.load();
    const all = this.entries();
    // why: deep-links from /variants (`?oid=<sha>`) and external tools
    //      hand us a specific commit to focus. If we resolve it, skip
    //      the "first visible" heuristic so the page lands where the
    //      caller pointed; otherwise fall through to default behavior.
    const requested = this.route.snapshot.queryParamMap.get('oid');
    const matched = requested ? all.find((e) => e.oid === requested) : null;
    if (matched) {
      this.selectedOidSignal.set(matched.oid);
      queueMicrotask(() => {
        document
          .getElementById(`commit-${matched.oid}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    } else if (selectFirst) {
      const first = all[0];
      if (first) this.selectedOidSignal.set(first.oid);
    }
    try {
      const noise = await this.diff.findNoiseCommits(all);
      this.noiseOidsSignal.set(noise);
      // why: don't bump off a commit the user deep-linked to, even if
      //      it's classified as noise — they asked for that exact one.
      if (selectFirst && !matched) {
        const current = this.selectedOidSignal();
        if (current && noise.has(current)) {
          const visible = all.find((e) => !noise.has(e.oid));
          if (visible) this.selectedOidSignal.set(visible.oid);
        }
      }
    } catch (e) {
      this.errors.report(e);
    }
  }

  protected toggleExpanded(path: string): void {
    this.expandedPathSignal.update((p) => (p === path ? null : path));
  }

  private readonly systemExpandedSignal = signal<Set<string>>(new Set());
  protected isSystemExpanded(path: string): boolean {
    return this.systemExpandedSignal().has(path);
  }
  protected toggleSystemExpanded(path: string): void {
    this.systemExpandedSignal.update((s) => {
      const next = new Set(s);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  protected facetOfMessage(message: string): Facet {
    return facetOf(message);
  }

  protected anchoredBadge(status: AnchorChangeStatus): string {
    if (status === 'added') return '+';
    if (status === 'removed') return '−';
    return '✎';
  }

  protected anchoredStatusLabel(mode: AnchorMode, status: AnchorChangeStatus): string {
    const prefix = mode === 'drafts' ? 'draft' : 'comment';
    const suffix = status === 'added' ? 'Added' : status === 'removed' ? 'Removed' : 'Modified';
    return this.i18n.t(`versioning.history.anchored.${prefix}${suffix}` as TranslationKey);
  }

  protected anchoredAnchorLabel(anchorType: string): string {
    if (anchorType === 'block') return this.i18n.t('versioning.history.anchored.anchorBlock');
    if (anchorType === 'doc') return this.i18n.t('versioning.history.anchored.anchorDoc');
    if (anchorType === 'entity') return this.i18n.t('versioning.history.anchored.anchorEntity');
    return anchorType;
  }

  protected formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  protected bucketLabel(id: BucketId): string {
    return this.i18n.t(BUCKET_LABEL_KEY[id]);
  }

  protected select(oid: string): void {
    this.selectedOidSignal.set(oid);
  }

  // Keyboard nav between milestones: '[' previous, ']' next. Bracket-keys are
  // a stable choice across keyboard layouts and don't collide with the inputs
  // inside the timeline head.
  @HostListener('document:keydown', ['$event'])
  protected onKeydown(ev: KeyboardEvent): void {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const target = ev.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    if (target?.isContentEditable) return;
    if (ev.key !== '[' && ev.key !== ']') return;
    const direction = ev.key === ']' ? 1 : -1;
    const target_ = this.findAdjacentMilestone(direction);
    if (!target_) return;
    ev.preventDefault();
    this.selectedOidSignal.set(target_);
    queueMicrotask(() => {
      document
        .getElementById(`commit-${target_}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  private findAdjacentMilestone(direction: 1 | -1): string | null {
    const entries = this.entries();
    const byOid = this.milestonesByOid();
    const oids = entries.map((e) => e.oid);
    const milestoneIndices: number[] = [];
    oids.forEach((oid, idx) => {
      if (byOid.has(oid)) milestoneIndices.push(idx);
    });
    if (milestoneIndices.length === 0) return null;
    const current = this.selectedOidSignal();
    const currentIdx = current ? oids.indexOf(current) : -1;
    if (currentIdx === -1) {
      return oids[direction === 1 ? milestoneIndices[0]! : milestoneIndices.at(-1)!]!;
    }
    if (direction === 1) {
      const next = milestoneIndices.find((i) => i > currentIdx);
      return next !== undefined ? oids[next]! : null;
    }
    const prev = [...milestoneIndices].reverse().find((i) => i < currentIdx);
    return prev !== undefined ? oids[prev]! : null;
  }

  private readonly restoringPathSignal = signal<string | null>(null);
  protected readonly restoringPath = this.restoringPathSignal.asReadonly();
  private readonly restoringCommitSignal = signal(false);
  protected readonly restoringCommit = this.restoringCommitSignal.asReadonly();

  protected async restoreEntity(d: EntityDiff, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    const entry = this.selectedEntry();
    if (!entry) return;
    if (this.restoringPathSignal() !== null) return;
    const mode = d.status === 'deleted' ? 'absent' : 'present';
    const key =
      mode === 'absent'
        ? 'versioning.history.restoreEntityDeleteConfirm'
        : 'versioning.history.restoreEntityConfirm';
    const message = this.i18n.t(key, { path: d.filepath, shortOid: entry.shortOid });
    // why: a confirm() is enough here — restore is reversible by selecting a
    //      newer commit. Strong modal is reserved for the per-commit restore
    //      that touches many entities at once.
    if (!window.confirm(message)) return;
    this.restoringPathSignal.set(d.filepath);
    try {
      await this.restore.restoreEntity(entry.oid, d.filepath, mode);
      await this.reloadAll(true);
    } catch (e) {
      this.errors.report(e);
    } finally {
      this.restoringPathSignal.set(null);
    }
  }

  protected markMilestone(): void {
    const entry = this.selectedEntry();
    if (!entry) return;
    void this.milestones.mark(entry.oid);
  }

  protected async restoreWholeCommit(): Promise<void> {
    const entry = this.selectedEntry();
    if (!entry) return;
    if (this.restoringCommitSignal()) return;
    const prompt = this.i18n.t('versioning.history.restoreCommitPrompt', {
      shortOid: entry.shortOid,
    });
    const typed = window.prompt(prompt);
    if (typed === null) return;
    if (typed.trim() !== entry.shortOid) {
      window.alert(this.i18n.t('versioning.history.restoreCommitMismatch'));
      return;
    }
    this.restoringCommitSignal.set(true);
    try {
      await this.restore.restoreCommit(entry.oid);
      await this.reloadAll(true);
    } catch (e) {
      this.errors.report(e);
    } finally {
      this.restoringCommitSignal.set(false);
    }
  }
}
