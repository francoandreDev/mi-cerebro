import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { triggerDownload } from '@shared/utils/trigger-download';
import { svgToPngBlob } from '@shared/utils/svg-to-png';

import type {
  ChalkColorId,
  ChalkLayer,
  ChalkSize,
  ChalkStroke,
  ChalkTool,
} from '../models/chalk.types';
import { ChalkBoardComponent } from './chalk-board.component';
import type { ChalkHistoryState } from './chalk-history.utils';
import {
  emptyChalkHistory,
  recordChalkHistory,
  redoChalkHistory,
  undoChalkHistory,
} from './chalk-history.utils';
import { ChalkLayersPanelComponent } from './chalk-layers-panel.component';
import { registerChalkShortcuts } from './chalk-shortcuts';
import type { ChalkExportFormat } from './chalk-toolbar.component';
import { ChalkToolbarComponent } from './chalk-toolbar.component';
import {
  addLayer,
  chalkExportFilename,
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
  readonly entityTitle = input<string>('');
  readonly listId = input<string>('');

  readonly layersChange = output<readonly ChalkLayer[]>();

  private readonly i18n = inject(I18nService);
  private readonly board = viewChild(ChalkBoardComponent);

  protected readonly active = signal<boolean>(false);
  protected readonly tool = signal<ChalkTool>('chalk');
  protected readonly color = signal<ChalkColorId>('white');
  protected readonly size = signal<ChalkSize>('m');
  protected readonly activeLayerId = signal<string | null>(null);
  protected readonly layersOpen = signal<boolean>(false);

  // why: local, session-scoped undo/redo — see chalk-history.utils.ts. Reset
  //      whenever the list identity changes since the overlay component
  //      instance is reused across `/lists/:id` navigations.
  private readonly history = signal<ChalkHistoryState>(emptyChalkHistory);
  protected readonly canUndo = computed(() => this.history().past.length > 0);
  protected readonly canRedo = computed(() => this.history().future.length > 0);

  protected readonly activeLayerHasStrokes = computed(() => {
    const id = this.activeLayerId();
    const layer = this.layers().find((l) => l.id === id);
    return (layer?.strokes.length ?? 0) > 0;
  });

  constructor() {
    effect(() => {
      this.listId();
      this.history.set(emptyChalkHistory);
    });
    registerChalkShortcuts({
      toggleMode: () => this.onToggleActive(),
      pickChalk: () => this.active() && this.tool.set('chalk'),
      pickEraser: () => this.active() && this.tool.set('eraser'),
      pickColor: (c) => this.active() && this.color.set(c),
      undo: () => this.active() && this.onUndo(),
      redo: () => this.active() && this.onRedo(),
    });
  }

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
    this.commit(pushStroke(layers, activeId, stroke));
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
    this.commit(eraseAt(this.layers(), id, event.point, event.widthPx, event.heightPx));
  }

  protected onClearActive(): void {
    const id = this.activeLayerId();
    if (!id) return;
    this.commit(clearLayer(this.layers(), id));
  }

  protected onAddLayer(): void {
    const { layers, activeId } = addLayer(
      this.layers(),
      this.defaultLayerName(this.layers().length),
    );
    this.activeLayerId.set(activeId);
    this.commit(layers);
  }

  protected onSelectLayer(id: string): void {
    this.activeLayerId.set(id);
  }

  protected onRenameLayer(event: { id: string; name: string }): void {
    this.commit(renameLayer(this.layers(), event.id, event.name));
  }

  protected onToggleVisible(id: string): void {
    this.commit(toggleLayerVisible(this.layers(), id));
  }

  protected onToggleLocked(id: string): void {
    this.commit(toggleLayerLocked(this.layers(), id));
  }

  protected onRemoveLayer(id: string): void {
    if (this.activeLayerId() === id) this.activeLayerId.set(null);
    this.commit(removeLayer(this.layers(), id));
  }

  protected onMoveLayer(event: { id: string; direction: -1 | 1 }): void {
    this.commit(moveLayer(this.layers(), event.id, event.direction));
  }

  protected onReorderLayer(event: { from: string; to: string }): void {
    this.commit(reorderLayer(this.layers(), event.from, event.to));
  }

  protected onUndo(): void {
    const step = undoChalkHistory(this.history(), this.layers());
    if (!step) return;
    this.history.set(step.history);
    this.layersChange.emit(step.layers);
  }

  protected onRedo(): void {
    const step = redoChalkHistory(this.history(), this.layers());
    if (!step) return;
    this.history.set(step.history);
    this.layersChange.emit(step.layers);
  }

  private commit(next: readonly ChalkLayer[]): void {
    this.history.update((h) => recordChalkHistory(h, this.layers()));
    this.layersChange.emit(next);
  }

  protected onToggleLayers(): void {
    this.layersOpen.update((v) => !v);
  }

  protected async onExportBoard(format: ChalkExportFormat): Promise<void> {
    const data = this.board()?.exportData();
    if (!data) return;
    const filename = chalkExportFilename(
      this.entityTitle() || this.t('lists.chalk.export'),
      format,
    );
    if (format === 'svg') {
      triggerDownload(new Blob([data.svg], { type: 'image/svg+xml' }), filename);
      return;
    }
    const png = await svgToPngBlob(data.svg, data.width, data.height);
    triggerDownload(png, filename);
  }

  private defaultLayerName(currentCount: number): string {
    return this.t('lists.chalk.layerDefault').replace('{n}', String(currentCount + 1));
  }
}
