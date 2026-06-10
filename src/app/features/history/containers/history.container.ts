import type { OnInit } from '@angular/core';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';

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
  providers: [HistoryService],
  templateUrl: './history.container.html',
  styleUrl: './history.container.css',
})
export class HistoryContainer implements OnInit {
  private readonly history = inject(HistoryService);
  protected readonly i18n = inject(I18nService);

  protected readonly buckets = this.history.buckets;
  protected readonly loading = this.history.loading;
  protected readonly error = this.history.error;
  protected readonly entries = this.history.entries;

  private readonly selectedOidSignal = signal<string | null>(null);
  protected readonly selectedOid = this.selectedOidSignal.asReadonly();
  protected readonly selectedEntry = computed<CommitEntry | null>(() => {
    const oid = this.selectedOidSignal();
    if (!oid) return null;
    return this.entries().find((e) => e.oid === oid) ?? null;
  });

  ngOnInit(): void {
    void this.history.load().then(() => {
      const first = this.entries()[0];
      if (first) this.selectedOidSignal.set(first.oid);
    });
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
}
