import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { ErrorService } from '@core/errors/error.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { RestoreService } from '@core/versioning/restore.service';
import type { Variant } from '@core/versioning/variants.types';
import { ConfirmController } from '@shared/confirm-dialog/confirm-controller';
import { ConfirmDialogComponent } from '@shared/confirm-dialog/confirm-dialog.component';
import { entityKindIcon } from '@shared/entity-cards/entity-kind-icon';
import { IconComponent } from '@shared/icon/icon.component';
import type { IconName } from '@shared/icon/icons.data';
import { McDatePipe } from '@shared/pipes/mc-date.pipe';

import { commitOriginColor, commitOriginName } from '../services/commit-origin';
import {
  compactDiffChunks,
  hasContextChunk,
  type AnchorChangeStatus,
  type AnchorMode,
  type InlineDiffChunk,
} from '../services/diff.utils';
import { facetOf, type Facet } from '../services/facet';
import type { CommitEntry, MilestoneEntry } from '../services/history.types';
import type { EntityDiff } from '../services/diff.service';
import type { MilestoneController } from '../services/milestone.controller';
import { readSS, writeSS } from '../services/session-store';
import type { EntityFeedRow, GroupKey } from '../containers/history.container';

const SS_COMPACT_DIFF = 'mc:history:compactDiff';
const MAX_VISIBLE_KIND_CHIPS = 4;

@Component({
  selector: 'mc-history-cordel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ConfirmDialogComponent, IconComponent, McDatePipe, NgTemplateOutlet],
  templateUrl: './history-cordel.component.html',
  styleUrl: './history-cordel.component.css',
})
export class HistoryCordelComponent {
  protected readonly i18n = inject(I18nService);
  private readonly errors = inject(ErrorService);
  private readonly restore = inject(RestoreService);

  readonly entry = input.required<CommitEntry>();
  readonly polaroids = input.required<readonly CommitEntry[]>();
  readonly selectedOid = input.required<string | null>();
  readonly headOid = input.required<string | null>();
  readonly fossilFocusOid = input.required<string | null>();
  readonly fossilFocusName = input.required<string | null>();
  readonly revealedOids = input.required<ReadonlySet<string>>();
  readonly revealingOids = input.required<ReadonlySet<string>>();
  readonly entityDiffs = input.required<readonly EntityDiff[]>();
  readonly diffLoading = input.required<boolean>();
  readonly diffSummary = input.required<{
    readonly total: number;
    readonly added: number;
    readonly modified: number;
    readonly deleted: number;
  }>();
  readonly groupedDiffs =
    input.required<readonly { key: GroupKey; items: readonly EntityDiff[] }[]>();
  readonly entityFeed = input.required<readonly EntityFeedRow[]>();
  readonly groupByType = input.required<boolean>();
  readonly expandedPath = input.required<string | null>();
  readonly query = input.required<string>();
  readonly enabledFacets = input.required<ReadonlySet<Facet>>();
  readonly allFacets = input.required<readonly Facet[]>();
  readonly onlyMilestones = input.required<boolean>();
  readonly milestonesByOid = input.required<ReadonlyMap<string, readonly MilestoneEntry[]>>();
  readonly originByOid = input.required<ReadonlyMap<string, string>>();
  readonly variantsById = input.required<ReadonlyMap<string, Variant>>();
  readonly milestones = input.required<MilestoneController>();

  readonly selectCommit = output<string>();
  readonly reveal = output<CommitEntry>();
  readonly clearFossilFocus = output<void>();
  readonly toggleExpanded = output<string>();
  readonly toggleGroupByType = output<void>();
  readonly queryChange = output<string>();
  readonly clearQuery = output<void>();
  readonly toggleFacet = output<Facet>();
  readonly toggleOnlyMilestones = output<void>();
  readonly zoomBack = output<void>();
  readonly restored = output<void>();

  protected readonly revealingCount = () => this.revealingOids().size;

  protected isFacetEnabled(f: Facet): boolean {
    return this.enabledFacets().has(f);
  }

  protected onQueryInput(ev: Event): void {
    this.queryChange.emit((ev.target as HTMLInputElement).value);
  }

  protected facetLabelKey(f: Facet): `versioning.history.facet.${Facet}` {
    return `versioning.history.facet.${f}`;
  }

  protected facetOfMessage(message: string): Facet {
    return facetOf(message);
  }

  protected commitOriginColor(oid: string): string | null {
    return commitOriginColor(oid, this.originByOid(), this.variantsById());
  }
  protected commitOriginName(oid: string): string | null {
    return commitOriginName(oid, this.originByOid(), this.variantsById());
  }

  protected milestonesFor(oid: string): readonly MilestoneEntry[] {
    return this.milestonesByOid().get(oid) ?? [];
  }

  protected isPolaroidRevealed(oid: string): boolean {
    return this.revealedOids().has(oid);
  }
  protected isPolaroidRevealing(oid: string): boolean {
    return this.revealingOids().has(oid);
  }

  protected visibleKinds(kinds: readonly string[]): readonly string[] {
    return kinds.slice(0, MAX_VISIBLE_KIND_CHIPS);
  }
  protected hiddenKindsCount(kinds: readonly string[]): number {
    return Math.max(0, kinds.length - MAX_VISIBLE_KIND_CHIPS);
  }
  protected primaryKindIcon(kinds: readonly string[]): IconName | null {
    const kind = kinds[0];
    return kind ? entityKindIcon(kind) : null;
  }

  // Split the commit message into its subject (first line) and trailer
  // block (the rest). The h3 only shows the subject so multi-line merge
  // messages don't crush together; trailers go into a collapsible
  // section below the header.
  protected subjectOf(message: string): string {
    const idx = message.indexOf('\n');
    return idx === -1 ? message : message.slice(0, idx);
  }
  protected bodyOf(message: string): string {
    const idx = message.indexOf('\n');
    return idx === -1 ? '' : message.slice(idx + 1).trim();
  }

  protected groupLabelKey(k: GroupKey): TranslationKey {
    return `versioning.history.summary.group.${k}`;
  }

  protected formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
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

  protected asInput(event: Event): HTMLInputElement {
    return event.target as HTMLInputElement;
  }

  // ---- Toggle "sólo cambios" del diff inline -----------------------------
  private readonly compactDiffSignal = signal(readSS(SS_COMPACT_DIFF) === '1');
  protected readonly compactDiff = this.compactDiffSignal.asReadonly();
  protected toggleCompactDiff(): void {
    this.compactDiffSignal.update((v) => !v);
  }
  protected visibleChunks(chunks: readonly InlineDiffChunk[]): readonly InlineDiffChunk[] {
    return this.compactDiffSignal() ? compactDiffChunks(chunks) : chunks;
  }
  protected chunksHaveContext(chunks: readonly InlineDiffChunk[]): boolean {
    return hasContextChunk(chunks);
  }

  constructor() {
    effect(() => writeSS(SS_COMPACT_DIFF, this.compactDiffSignal() ? '1' : '0'));
  }

  // ---- Marcar / renombrar hito -------------------------------------------
  protected readonly markingMilestone = signal(false);
  protected readonly milestoneNameDraft = signal('');
  protected readonly milestoneDescDraft = signal('');

  protected startMarkMilestone(): void {
    this.milestoneNameDraft.set('');
    this.milestoneDescDraft.set('');
    this.markingMilestone.set(true);
  }
  protected cancelMarkMilestone(): void {
    this.markingMilestone.set(false);
  }
  protected commitMarkMilestone(): void {
    const entry = this.entry();
    const name = this.milestoneNameDraft();
    if (!name.trim()) return;
    this.markingMilestone.set(false);
    void this.milestones().mark(entry.oid, entry.message, name, this.milestoneDescDraft());
  }

  protected readonly renamingMilestoneName = signal<string | null>(null);
  protected readonly renameMilestoneDraft = signal('');

  protected startRenameMilestone(m: MilestoneEntry): void {
    this.renamingMilestoneName.set(m.name);
    this.renameMilestoneDraft.set(m.name);
  }
  protected cancelRenameMilestone(): void {
    this.renamingMilestoneName.set(null);
  }
  protected commitRenameMilestone(m: MilestoneEntry): void {
    const draft = this.renameMilestoneDraft();
    this.renamingMilestoneName.set(null);
    if (!draft.trim() || draft.trim() === m.name) return;
    void this.milestones().rename(m, draft);
  }

  protected readonly collisionNameDraft = signal('');
  protected commitCollisionUseOther(): void {
    const name = this.collisionNameDraft();
    if (!name.trim()) return;
    this.collisionNameDraft.set('');
    void this.milestones().resolveUseOther(name);
  }

  // ---- Restaurar entidad / commit -----------------------------------------
  protected readonly restoreConfirm = new ConfirmController();
  private readonly restoringPathSignal = signal<string | null>(null);
  protected readonly restoringPath = this.restoringPathSignal.asReadonly();
  private readonly restoringCommitSignal = signal(false);
  protected readonly restoringCommit = this.restoringCommitSignal.asReadonly();

  protected restoreEntity(d: EntityDiff, event: MouseEvent): void {
    event.stopPropagation();
    const entry = this.entry();
    if (this.restoringPathSignal() !== null) return;
    const mode = d.status === 'deleted' ? 'absent' : 'present';
    const key =
      mode === 'absent'
        ? 'versioning.history.restoreEntityDeleteConfirm'
        : 'versioning.history.restoreEntityConfirm';
    const message = this.i18n.t(key, { path: d.filepath, shortOid: entry.shortOid });
    this.restoreConfirm.ask(
      {
        title: this.i18n.t('versioning.history.confirm.restoreEntity.title'),
        message,
        confirmLabel: this.i18n.t('versioning.history.confirm.restoreEntity.confirm'),
        cancelLabel: this.i18n.t('versioning.history.confirm.cancel'),
        tone: mode === 'absent' ? 'danger' : 'default',
      },
      async () => {
        this.restoringPathSignal.set(d.filepath);
        try {
          await this.restore.restoreEntity(entry.oid, d.filepath, mode);
          this.restored.emit();
        } catch (e) {
          this.errors.report(e);
        } finally {
          this.restoringPathSignal.set(null);
        }
      },
    );
  }

  protected readonly restoreCommitDraft = signal<string | null>(null);
  protected readonly restoreCommitMismatch = signal(false);

  protected startRestoreCommit(): void {
    this.restoreCommitMismatch.set(false);
    this.restoreCommitDraft.set('');
  }
  protected cancelRestoreCommit(): void {
    this.restoreCommitDraft.set(null);
  }
  protected async confirmRestoreCommit(): Promise<void> {
    const entry = this.entry();
    const typed = this.restoreCommitDraft();
    if (typed === null) return;
    if (typed.trim() !== entry.shortOid) {
      this.restoreCommitMismatch.set(true);
      return;
    }
    this.restoreCommitDraft.set(null);
    this.restoringCommitSignal.set(true);
    try {
      await this.restore.restoreCommit(entry.oid);
      this.restored.emit();
    } catch (e) {
      this.errors.report(e);
    } finally {
      this.restoringCommitSignal.set(false);
    }
  }
}
