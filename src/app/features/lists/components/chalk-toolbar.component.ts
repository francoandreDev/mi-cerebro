import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { ConfirmController } from '@shared/confirm-dialog/confirm-controller';
import { ConfirmDialogComponent } from '@shared/confirm-dialog/confirm-dialog.component';
import { IconComponent } from '@shared/icon/icon.component';

import type { ChalkColorId, ChalkSize, ChalkTool } from '../models/chalk.types';
import { CHALK_COLORS } from '../models/chalk.types';

const SIZES: readonly ChalkSize[] = ['s', 'm', 'l'];

@Component({
  selector: 'mc-chalk-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ConfirmDialogComponent, IconComponent],
  templateUrl: './chalk-toolbar.component.html',
  styleUrl: './chalk-toolbar.component.css',
})
export class ChalkToolbarComponent {
  readonly active = input<boolean>(false);
  readonly tool = input<ChalkTool>('chalk');
  readonly color = input<ChalkColorId>('white');
  readonly size = input<ChalkSize>('m');
  readonly layersOpen = input<boolean>(false);
  readonly canClear = input<boolean>(false);

  readonly toggleActive = output<void>();
  readonly toolChange = output<ChalkTool>();
  readonly colorChange = output<ChalkColorId>();
  readonly sizeChange = output<ChalkSize>();
  readonly clearActive = output<void>();
  readonly toggleLayers = output<void>();

  protected readonly palette = CHALK_COLORS;
  protected readonly sizes = SIZES;

  private readonly i18n = inject(I18nService);

  protected readonly confirm = new ConfirmController();

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected colorLabel(id: ChalkColorId): string {
    return this.t(`lists.chalk.color.${id}` as TranslationKey);
  }

  protected sizeLabel(s: ChalkSize): string {
    return this.t(`lists.chalk.size.${s}` as TranslationKey);
  }

  protected onClear(): void {
    if (!this.canClear()) return;
    this.confirm.ask(
      {
        title: this.t('lists.chalk.confirm.clear.title'),
        message: this.t('lists.chalk.clearConfirm'),
        confirmLabel: this.t('lists.chalk.confirm.clear.confirm'),
        cancelLabel: this.t('lists.chalk.confirm.cancel'),
        tone: 'danger',
      },
      () => this.clearActive.emit(),
    );
  }
}
