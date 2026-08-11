import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey, TranslationParams } from '@core/i18n/i18n.types';
import { ConfirmController } from '@shared/confirm-dialog/confirm-controller';
import { ConfirmDialogComponent } from '@shared/confirm-dialog/confirm-dialog.component';
import { IconComponent } from '@shared/icon/icon.component';
import { createDndController } from '@shared/utils/dnd-controller';

import { CHALK_COLORS, type ChalkLayer } from './chalk.types';

@Component({
  selector: 'mc-chalk-layers-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ConfirmDialogComponent, IconComponent],
  templateUrl: './chalk-layers-panel.component.html',
  styleUrl: './chalk-layers-panel.component.css',
})
export class ChalkLayersPanelComponent {
  readonly layers = input.required<readonly ChalkLayer[]>();
  readonly activeId = input<string | null>(null);

  readonly addLayer = output<void>();
  readonly selectLayer = output<string>();
  readonly renameLayer = output<{ id: string; name: string }>();
  readonly toggleVisible = output<string>();
  readonly toggleLocked = output<string>();
  readonly removeLayer = output<string>();
  readonly moveLayer = output<{ id: string; direction: -1 | 1 }>();
  readonly reorderLayer = output<{ from: string; to: string }>();
  readonly closeRequested = output<void>();

  private readonly i18n = inject(I18nService);

  protected readonly dnd = createDndController<string>();
  protected readonly confirm = new ConfirmController();

  protected t(key: TranslationKey, params?: TranslationParams): string {
    return this.i18n.t(key, params);
  }

  protected onRenameInput(id: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.renameLayer.emit({ id, name: value });
  }

  protected onRemove(layer: ChalkLayer): void {
    this.confirm.ask(
      {
        title: this.t('chalk.confirm.remove.title'),
        message: this.t('chalk.removeConfirm').replace('{name}', layer.name),
        confirmLabel: this.t('chalk.confirm.remove.confirm'),
        cancelLabel: this.t('chalk.confirm.cancel'),
        tone: 'danger',
      },
      () => this.removeLayer.emit(layer.id),
    );
  }

  protected onLayerDrop(targetId: string): void {
    const result = this.dnd.onDrop(targetId);
    if (result && result.id !== result.zone) {
      this.reorderLayer.emit({ from: result.id, to: result.zone });
    }
  }

  // why: le da a cada capa una identidad visual además del nombre — el
  //      color del trazo más reciente, así se reconoce "cuál es cuál" de
  //      un vistazo en vez de tener que leer todos los nombres.
  protected swatchHex(layer: ChalkLayer): string | null {
    const last = layer.strokes[layer.strokes.length - 1];
    if (!last) return null;
    return CHALK_COLORS.find((c) => c.id === last.color)?.hex ?? null;
  }

  protected strokeLabel(layer: ChalkLayer): string {
    return layer.strokes.length === 0
      ? this.t('chalk.layerEmpty')
      : this.t('chalk.strokeCount', { n: layer.strokes.length });
  }
}
