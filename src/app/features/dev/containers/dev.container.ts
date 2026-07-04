import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { ErrorService } from '@core/errors/error.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { CompactionSchedulerService } from '@core/versioning/compaction-scheduler.service';
import { IconComponent } from '@shared/icon/icon.component';

// why: internal QA-only page (not linked from the rail/nav). Exposes
//      CompactionSchedulerService.runOnce() as a button instead of the
//      browser devtools console — see docs/deferred.md "Dev panel para
//      la compactación".
@Component({
  selector: 'mc-dev',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './dev.container.html',
  styleUrl: './dev.container.css',
})
export class DevContainer {
  private readonly compactionScheduler = inject(CompactionSchedulerService);
  private readonly errors = inject(ErrorService);
  private readonly i18n = inject(I18nService);

  protected readonly threshold = this.compactionScheduler.threshold;
  protected readonly maxBranchCommitCount = this.compactionScheduler.maxBranchCommitCount;
  protected readonly running = signal(false);
  protected readonly done = signal(false);

  protected t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  protected async runCompactionNow(): Promise<void> {
    this.running.set(true);
    this.done.set(false);
    try {
      await this.compactionScheduler.runOnce({ ignoreThreshold: true });
      this.done.set(true);
    } catch (e) {
      this.errors.report(e);
    } finally {
      this.running.set(false);
    }
  }
}
