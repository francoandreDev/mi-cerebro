import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import type { DashboardGoalItem } from '@core/dashboard/dashboard.types';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';
import { IconComponent } from '@shared/icon/icon.component';
import { McDatePipe } from '@shared/pipes/mc-date.pipe';
import { TagChipComponent } from '@shared/tags/tag-chip.component';

@Component({
  selector: 'mc-dashboard-goals-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, McDatePipe, TagChipComponent],
  templateUrl: './dashboard-goals-widget.component.html',
  styleUrl: './dashboard-widget.component.css',
})
export class DashboardGoalsWidgetComponent {
  readonly goals = input.required<readonly DashboardGoalItem[]>();
  readonly availableTags = input.required<readonly Tag[]>();
  readonly open = output<DashboardGoalItem>();

  private readonly i18n = inject(I18nService);

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected resolvedTags(goal: DashboardGoalItem): readonly Tag[] {
    const available = this.availableTags();
    return goal.tags
      .map((id) => available.find((tag) => tag.id === id))
      .filter((tag): tag is Tag => tag !== undefined);
  }
}
