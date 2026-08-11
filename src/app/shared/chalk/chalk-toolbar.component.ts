import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { ConfirmController } from '@shared/confirm-dialog/confirm-controller';
import { ConfirmDialogComponent } from '@shared/confirm-dialog/confirm-dialog.component';
import { IconComponent } from '@shared/icon/icon.component';
import { MenuButtonComponent } from '@shared/menu-button/menu-button.component';

import type { ChalkColorId, ChalkSize, ChalkTool } from './chalk.types';
import { CHALK_COLORS } from './chalk.types';

const SIZES: readonly ChalkSize[] = ['s', 'm', 'l'];

export type ChalkExportFormat = 'png' | 'svg';

@Component({
  selector: 'mc-chalk-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ConfirmDialogComponent, IconComponent, MenuButtonComponent],
  templateUrl: './chalk-toolbar.component.html',
  styleUrl: './chalk-toolbar.component.css',
})
export class ChalkToolbarComponent {
  readonly active = input<boolean>(false);
  readonly tool = input<ChalkTool>('chalk');
  readonly color = input<ChalkColorId>('white');
  readonly size = input<ChalkSize>('m');
  readonly layersOpen = input<boolean>(false);
  readonly layerCount = input<number>(0);
  readonly canClear = input<boolean>(false);
  readonly canUndo = input<boolean>(false);
  readonly canRedo = input<boolean>(false);

  readonly toggleActive = output<void>();
  readonly toolChange = output<ChalkTool>();
  readonly colorChange = output<ChalkColorId>();
  readonly sizeChange = output<ChalkSize>();
  readonly clearActive = output<void>();
  readonly toggleLayers = output<void>();
  readonly exportBoard = output<ChalkExportFormat>();
  readonly undo = output<void>();
  readonly redo = output<void>();

  protected readonly palette = CHALK_COLORS;
  protected readonly sizes = SIZES;

  protected readonly exportOptions = [
    { key: 'png', label: 'PNG' },
    { key: 'svg', label: 'SVG' },
  ];

  private readonly i18n = inject(I18nService);

  protected readonly confirm = new ConfirmController();

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected colorLabel(id: ChalkColorId): string {
    return this.t(`chalk.color.${id}` as TranslationKey);
  }

  protected sizeLabel(s: ChalkSize): string {
    return this.t(`chalk.size.${s}` as TranslationKey);
  }

  protected onExportChoice(key: string): void {
    if (key === 'png' || key === 'svg') this.exportBoard.emit(key);
  }

  protected onClear(): void {
    if (!this.canClear()) return;
    this.confirm.ask(
      {
        title: this.t('chalk.confirm.clear.title'),
        message: this.t('chalk.clearConfirm'),
        confirmLabel: this.t('chalk.confirm.clear.confirm'),
        cancelLabel: this.t('chalk.confirm.cancel'),
        tone: 'danger',
      },
      () => this.clearActive.emit(),
    );
  }
}
