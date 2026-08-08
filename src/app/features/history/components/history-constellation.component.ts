import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import { IconComponent } from '@shared/icon/icon.component';
import { McDatePipe } from '@shared/pipes/mc-date.pipe';

import { buildConstellation, type ConstellationStar } from '../services/constellation.utils';
import type { DayAggregate } from '../services/history-loader.service';

// Secondary /history view (docs/deferred/versionado.md): a starfield read
// of work rhythm instead of a navigable commit list — deliberately NOT
// click-to-commit. Position = time (so gaps are literal dark sky), size =
// that day's commit volume. Toggled independently of the panorama/strata/
// detail zoom continuum, not part of it.
@Component({
  selector: 'mc-history-constellation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, McDatePipe],
  templateUrl: './history-constellation.component.html',
  styleUrl: './history-constellation.component.css',
})
export class HistoryConstellationComponent {
  protected readonly i18n = inject(I18nService);

  readonly aggregates = input.required<readonly DayAggregate[]>();
  readonly loading = input.required<boolean>();

  readonly dismiss = output<void>();

  protected readonly stars = computed<readonly ConstellationStar[]>(() =>
    buildConstellation(this.aggregates()),
  );

  protected readonly busiestDay = computed<ConstellationStar | null>(() => {
    const list = this.stars();
    if (list.length === 0) return null;
    return list.reduce((best, s) => (s.count > best.count ? s : best));
  });

  protected readonly totalCommits = computed(() =>
    this.aggregates().reduce((sum, a) => sum + a.count, 0),
  );

  protected readonly activeDaySpan = computed(() => this.stars().length);
}
