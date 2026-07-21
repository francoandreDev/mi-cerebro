import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { TrashKind } from '@core/trash/trash.types';
import { IconComponent } from '@shared/icon/icon.component';
import type { IconName } from '@shared/icon/icons.data';

import { computeTrashCountdown, TRASH_RETENTION_DAYS } from '../utils/trash-countdown.utils';

const KIND_ICON: Record<TrashKind, IconName> = {
  note: 'note',
  task: 'check',
  goal: 'target',
  list: 'package',
  writing: 'paperclip',
  book: 'books',
  image: 'image',
  file: 'file',
  reminder: 'bell',
  track: 'music-note',
  playlist: 'music-notes',
};

@Component({
  selector: 'mc-trash-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './trash-card.component.html',
  styleUrl: './trash-card.component.css',
})
export class TrashCardComponent {
  readonly kind = input.required<TrashKind>();
  readonly kindLabel = input.required<string>();
  readonly title = input.required<string>();
  readonly deletedAt = input.required<string>();
  readonly view = output<void>();
  readonly restore = output<void>();
  readonly purge = output<void>();

  private readonly i18n = inject(I18nService);

  protected readonly icon = computed<IconName>(() => KIND_ICON[this.kind()]);
  protected readonly countdown = computed(() => computeTrashCountdown(this.deletedAt()));
  protected readonly retention = TRASH_RETENTION_DAYS;

  protected readonly countdownLabel = computed<string>(() => {
    const c = this.countdown();
    if (c.daysLeft === 0) return this.t('trash.countdown.today');
    return this.t('trash.countdown.daysLeft').replace('{n}', String(c.daysLeft));
  });

  protected readonly countdownAria = computed<string>(() =>
    this.t('trash.countdown.aria')
      .replace('{n}', String(this.countdown().daysLeft))
      .replace('{total}', String(TRASH_RETENTION_DAYS)),
  );

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onView(event: Event): void {
    event.stopPropagation();
    this.view.emit();
  }
  protected onRestore(event: Event): void {
    event.stopPropagation();
    this.restore.emit();
  }
  protected onPurge(event: Event): void {
    event.stopPropagation();
    this.purge.emit();
  }
}
