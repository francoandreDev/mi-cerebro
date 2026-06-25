import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';

interface CuartoView {
  readonly index: number;
  readonly label: string;
  readonly count: number;
  readonly active: boolean;
}

@Component({
  selector: 'mc-room-minimap',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './room-minimap.component.html',
  styleUrl: './room-minimap.component.css',
})
export class RoomMinimapComponent {
  readonly cuartoSizes = input.required<readonly number[]>();
  readonly cuartoIndex = input<number>(0);

  readonly jump = output<number>();

  private readonly i18n = inject(I18nService);

  protected readonly cuartos = computed<readonly CuartoView[]>(() => {
    const sizes = this.cuartoSizes();
    const active = this.cuartoIndex();
    const total = sizes.length;
    return sizes.map((count, index) => ({
      index,
      label: this.t('images.museum.cuarto', { n: index + 1, total }),
      count,
      active: index === active,
    }));
  });

  protected t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  protected onJump(index: number): void {
    this.jump.emit(index);
  }

  protected dotIndices(count: number): readonly number[] {
    return Array.from({ length: count }, (_, i) => i);
  }
}
