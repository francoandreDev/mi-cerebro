import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';

import type {
  ChalkColorId,
  ChalkLayer,
  ChalkSize,
  ChalkStroke,
  ChalkTool,
} from '../models/chalk.types';
import { ChalkBoardComponent } from './chalk-board.component';
import { ChalkLayersPanelComponent } from './chalk-layers-panel.component';
import { ChalkToolbarComponent } from './chalk-toolbar.component';
import {
  addLayer,
  clearLayer,
  ensureActiveLayer,
  eraseAt,
  moveLayer,
  pushStroke,
  removeLayer,
  renameLayer,
  reorderLayer,
  toggleLayerLocked,
  toggleLayerVisible,
} from './chalk.utils';

@Component({
  selector: 'mc-chalkboard-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChalkBoardComponent, ChalkToolbarComponent, ChalkLayersPanelComponent],
  templateUrl: './chalkboard-overlay.component.html',
  styleUrl: './chalkboard-overlay.component.css',
})
export class ChalkboardOverlayComponent {
  readonly layers = input.required<readonly ChalkLayer[]>();
  readonly editable = input<boolean>(true);

  readonly layersChange = output<readonly ChalkLayer[]>();

  private readonly i18n = inject(I18nService);

  protected readonly active = signal<boolean>(false);
  protected readonly tool = signal<ChalkTool>('chalk');
  protected readonly color = signal<ChalkColorId>('white');
  protected readonly size = signal<ChalkSize>('m');
  protected readonly activeLayerId = signal<string | null>(null);
  protected readonly layersOpen = signal<boolean>(false);

  protected readonly activeLayerHasStrokes = computed(() => {
    const id = this.activeLayerId();
    const layer = this.layers().find((l) => l.id === id);
    return (layer?.strokes.length ?? 0) > 0;
  });

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onToggleActive(): void {
    if (!this.editable()) return;
    this.active.update((v) => !v);
  }

  protected onStrokeFinished(stroke: ChalkStroke): void {
    if (!this.editable()) return;
    const { layers, activeId } = ensureActiveLayer(
      this.layers(),
      this.activeLayerId(),
      this.defaultLayerName(this.layers().length),
    );
    if (activeId !== this.activeLayerId()) this.activeLayerId.set(activeId);
    this.layersChange.emit(pushStroke(layers, activeId, stroke));
  }

  protected onErase(event: {
    point: readonly [number, number];
    widthPx: number;
    heightPx: number;
  }): void {
    if (!this.editable()) return;
    const id = this.activeLayerId();
    if (!id) return;
    const layer = this.layers().find((l) => l.id === id);
    if (!layer || layer.locked || !layer.visible) return;
    this.layersChange.emit(eraseAt(this.layers(), id, event.point, event.widthPx, event.heightPx));
  }

  protected onClearActive(): void {
    const id = this.activeLayerId();
    if (!id) return;
    this.layersChange.emit(clearLayer(this.layers(), id));
  }

  protected onAddLayer(): void {
    const { layers, activeId } = addLayer(
      this.layers(),
      this.defaultLayerName(this.layers().length),
    );
    this.activeLayerId.set(activeId);
    this.layersChange.emit(layers);
  }

  protected onSelectLayer(id: string): void {
    this.activeLayerId.set(id);
  }

  protected onRenameLayer(event: { id: string; name: string }): void {
    this.layersChange.emit(renameLayer(this.layers(), event.id, event.name));
  }

  protected onToggleVisible(id: string): void {
    this.layersChange.emit(toggleLayerVisible(this.layers(), id));
  }

  protected onToggleLocked(id: string): void {
    this.layersChange.emit(toggleLayerLocked(this.layers(), id));
  }

  protected onRemoveLayer(id: string): void {
    if (this.activeLayerId() === id) this.activeLayerId.set(null);
    this.layersChange.emit(removeLayer(this.layers(), id));
  }

  protected onMoveLayer(event: { id: string; direction: -1 | 1 }): void {
    this.layersChange.emit(moveLayer(this.layers(), event.id, event.direction));
  }

  protected onReorderLayer(event: { from: string; to: string }): void {
    this.layersChange.emit(reorderLayer(this.layers(), event.from, event.to));
  }

  protected onToggleLayers(): void {
    this.layersOpen.update((v) => !v);
  }

  private defaultLayerName(currentCount: number): string {
    return this.t('lists.chalk.layerDefault').replace('{n}', String(currentCount + 1));
  }
}
