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

import { HistoryDiffService } from '../services/diff.service';
import type { EntityDiff } from '../services/diff.service';
import { HistoryService } from '../services/history.service';
import type { BucketId, CommitEntry } from '../services/history.types';

const BUCKET_LABEL_KEY: Record<BucketId, string> = {
  today: 'versioning.history.bucket.today',
  yesterday: 'versioning.history.bucket.yesterday',
  'this-week': 'versioning.history.bucket.thisWeek',
  'last-week': 'versioning.history.bucket.lastWeek',
  'two-weeks': 'versioning.history.bucket.twoWeeks',
  'one-month': 'versioning.history.bucket.oneMonth',
  older: 'versioning.history.bucket.older',
};

@Component({
  selector: 'mc-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [HistoryService, HistoryDiffService],
  templateUrl: './history.container.html',
  styleUrl: './history.container.css',
})
export class HistoryContainer implements OnInit {
  private readonly history = inject(HistoryService);
  private readonly diff = inject(HistoryDiffService);
  private readonly restore = inject(RestoreService);
  private readonly errors = inject(ErrorService);
  protected readonly i18n = inject(I18nService);

  protected readonly buckets = this.history.buckets;
  protected readonly loading = this.history.loading;
  protected readonly error = this.history.error;
  protected readonly entries = this.history.entries;
  protected readonly headOid = this.history.headOid;

  private readonly selectedOidSignal = signal<string | null>(null);
  protected readonly selectedOid = this.selectedOidSignal.asReadonly();
  protected readonly selectedEntry = computed<CommitEntry | null>(() => {
    const oid = this.selectedOidSignal();
    if (!oid) return null;
    return this.entries().find((e) => e.oid === oid) ?? null;
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

  protected formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  protected bucketLabel(id: BucketId): string {
    // why: BUCKET_LABEL_KEY values are typed only as string here, but each is a
    //      real TranslationKey at runtime. Cast happens inside the i18n call.
    return this.i18n.t(BUCKET_LABEL_KEY[id] as never);
  }

  protected select(oid: string): void {
    this.selectedOidSignal.set(oid);
  }

  protected formatTime(d: Date): string {
    const pad = (n: number): string => n.toString().padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
