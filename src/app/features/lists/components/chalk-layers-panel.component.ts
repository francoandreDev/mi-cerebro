import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { IconComponent } from '@shared/icon/icon.component';

import type { ChalkLayer } from '../models/chalk.types';

@Component({
  selector: 'mc-chalk-layers-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
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
  readonly closeRequested = output<void>();

  private readonly i18n = inject(I18nService);

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onRenameInput(id: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.renameLayer.emit({ id, name: value });
  }

  protected onRemove(layer: ChalkLayer): void {
    const ok = confirm(this.t('lists.chalk.removeConfirm').replace('{name}', layer.name));
    if (ok) this.removeLayer.emit(layer.id);
  }
}
