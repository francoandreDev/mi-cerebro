import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';

import type { Bucket } from '../services/task-buckets';
import type { PlantStage } from './plant-glyphs';

@Component({
  selector: 'mc-planter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './planter.component.html',
  styleUrl: './planter.component.css',
})
export class PlanterComponent {
  readonly stage = input.required<PlantStage>();
  readonly bucket = input.required<Bucket>();
  readonly title = input.required<string>();
  readonly emptyLabel = input.required<string>();
  readonly count = input<number>(0);
  readonly dragOver = input<boolean>(false);

  readonly dragEnter = output<Bucket>();
  readonly dragLeaveBucket = output<Bucket>();
  readonly dropOn = output<Bucket>();

  private readonly i18n = inject(I18nService);

  protected readonly soilClass = computed(() => {
    if (this.stage() === 'seed') return 'soil soil--dry';
    if (this.stage() === 'sprout') return 'soil soil--dirty';
    return 'soil soil--fertile';
  });

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  protected onDragEnter(): void {
    this.dragEnter.emit(this.bucket());
  }

  protected onDragLeave(): void {
    this.dragLeaveBucket.emit(this.bucket());
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dropOn.emit(this.bucket());
  }
}
