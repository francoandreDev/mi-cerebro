import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import type { TrashKind } from '@core/trash/trash.types';
import { entityKindIcon } from '@shared/entity-cards/entity-kind-icon';
import { IconComponent } from '@shared/icon/icon.component';
import type { IconName } from '@shared/icon/icons.data';

const ORDER: readonly TrashKind[] = [
  'note',
  'task',
  'goal',
  'list',
  'writing',
  'book',
  'image',
  'file',
  'reminder',
  'track',
  'playlist',
];

interface KindChip {
  readonly kind: TrashKind;
  readonly label: string;
  readonly count: number;
}

@Component({
  selector: 'mc-trash-filter-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './trash-filter-bar.component.html',
  styleUrl: './trash-filter-bar.component.css',
})
export class TrashFilterBarComponent {
  readonly counts = input.required<Readonly<Record<TrashKind, number>>>();
  readonly total = input.required<number>();
  readonly active = input<TrashKind | null>(null);
  readonly kindChange = output<TrashKind | null>();

  private readonly i18n = inject(I18nService);

  protected readonly chips = computed<readonly KindChip[]>(() => {
    const counts = this.counts();
    return ORDER.filter((k) => counts[k] > 0).map((k) => ({
      kind: k,
      label: this.t(`trash.kind.${k}` as TranslationKey),
      count: counts[k],
    }));
  });

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onSelect(kind: TrashKind | null): void {
    this.kindChange.emit(kind);
  }

  protected iconFor(kind: TrashKind): IconName {
    return entityKindIcon(kind);
  }
}
