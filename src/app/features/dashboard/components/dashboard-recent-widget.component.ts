import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { Tag } from '@core/tags/tag.types';
import { IconComponent } from '@shared/icon/icon.component';
import type { IconName } from '@shared/icon/icons.data';
import { McDatePipe } from '@shared/pipes/mc-date.pipe';
import { TagChipComponent } from '@shared/tags/tag-chip.component';

import type { DashboardRecentEntry } from '@core/dashboard/dashboard.types';

@Component({
  selector: 'mc-dashboard-recent-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, McDatePipe, TagChipComponent],
  templateUrl: './dashboard-recent-widget.component.html',
  styleUrl: './dashboard-widget.component.css',
})
export class DashboardRecentWidgetComponent {
  readonly entries = input.required<readonly DashboardRecentEntry[]>();
  readonly availableTags = input.required<readonly Tag[]>();
  readonly open = output<DashboardRecentEntry>();

  private readonly i18n = inject(I18nService);

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected entryIcon(entry: DashboardRecentEntry): IconName {
    return entry.kind === 'note' ? 'note' : 'pen-nib';
  }

  protected resolvedTags(entry: DashboardRecentEntry): readonly Tag[] {
    const available = this.availableTags();
    return entry.tags
      .map((id) => available.find((tag) => tag.id === id))
      .filter((tag): tag is Tag => tag !== undefined);
  }
}
