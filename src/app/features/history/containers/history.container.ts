import type { OnInit } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';

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

@Component({
  selector: 'mc-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [HistoryService, HistoryDiffService, MilestoneController],
  imports: [McDatePipe, IconComponent],
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

  protected readonly loading = this.history.loading;
  protected readonly error = this.history.error;
  protected readonly entries = this.history.entries;
  protected readonly headOid = this.history.headOid;
  protected readonly milestonesByOid = this.history.milestonesByOid;

  private readonly onlyMilestonesSignal = signal(false);
  protected readonly onlyMilestones = this.onlyMilestonesSignal.asReadonly();
  protected toggleOnlyMilestones(): void {
    this.onlyMilestonesSignal.update((v) => !v);
  }

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
  protected readonly buckets = computed<readonly CommitBucket[]>(() => {
    const all = this.history.buckets();
    const onlyMile = this.onlyMilestonesSignal();
    const facets = this.enabledFacetsSignal();
    const byOid = this.milestonesByOid();
    const matches = (entry: CommitEntry): boolean => {
      if (!facets.has(facetOf(entry.message))) return false;
      if (onlyMile && !byOid.has(entry.oid)) return false;
      return true;
    };
    const hits = (item: TimelineItem): boolean => {
      if (item.kind === 'commit') return matches(item.entry);
      return item.members.some(matches);
    };
    return all
      .map((b) => ({ id: b.id, items: b.items.filter(hits) }))
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
    void this.history.load().then(() => {
      const first = this.entries()[0];
      if (first) this.selectedOidSignal.set(first.oid);
    });
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
      await this.history.load();
      const first = this.entries()[0];
      if (first) this.selectedOidSignal.set(first.oid);
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
      await this.history.load();
      const first = this.entries()[0];
      if (first) this.selectedOidSignal.set(first.oid);
    } catch (e) {
      this.errors.report(e);
    } finally {
      this.restoringCommitSignal.set(false);
    }
  }
}
