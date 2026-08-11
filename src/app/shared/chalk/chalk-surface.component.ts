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

import type { ChalkExportData } from './chalk-board.component';
import { ChalkBoardComponent } from './chalk-board.component';
import type { ChalkHistoryState } from './chalk-history.utils';
import {
  emptyChalkHistory,
  recordChalkHistory,
  redoChalkHistory,
  undoChalkHistory,
} from './chalk-history.utils';
import { ChalkLayersPanelComponent } from './chalk-layers-panel.component';
import type { ChalkColorId, ChalkLayer, ChalkSize, ChalkStroke, ChalkTool } from './chalk.types';
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

// why: extracted out of ChalkboardOverlayComponent (2026-08-10, ver
//      docs/proyecto/features.md) para que books pueda montar dos
//      superficies de dibujo independientes (una por página del spread)
//      compartiendo un único toolbar arriba — cada superficie sigue
//      llevando sus propias capas + historial de undo/redo + panel de
//      capas, pero ya no maneja active/tool/color/size (eso ahora es
//      responsabilidad de quien orquesta: ChalkboardOverlayComponent para
//      listas, ChapterEditorPaneComponent para libros).
@Component({
  selector: 'mc-chalk-surface',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChalkBoardComponent, ChalkLayersPanelComponent],
  templateUrl: './chalk-surface.component.html',
  styleUrl: './chalk-surface.component.css',
  host: {
    '(pointerdown)': 'focused.emit()',
  },
})
export class ChalkSurfaceComponent {
  // why: NO required — el toolbar que lee canClear()/canRedo() vía
  //      viewChild() puede evaluar su binding antes de que Angular escriba
  //      este input en la primera pasada de change detection (el toolbar
  //      precede a mc-chalk-surface en el DOM), y un required input sin
  //      valor todavía lanza NG0950. `[]` es un default seguro.
  readonly layers = input<readonly ChalkLayer[]>([]);
  readonly editable = input<boolean>(true);
  readonly active = input<boolean>(false);
  readonly tool = input<ChalkTool>('chalk');
  readonly color = input<ChalkColorId>('white');
  readonly size = input<ChalkSize>('m');
  // why: identidad de la superficie — resetea el historial de undo/redo
  //      cuando cambia (ver effect() abajo). En listas es el id de la
  //      lista; en libros, `${chapterId}:${pageIndex}` (cada página tiene
  //      su propio historial).
  readonly entityId = input<string>('');

  readonly layersChange = output<readonly ChalkLayer[]>();
  readonly focused = output<void>();

  private readonly i18n = inject(I18nService);
  private readonly board = viewChild(ChalkBoardComponent);

  protected readonly activeLayerId = signal<string | null>(null);
  readonly layersOpen = signal<boolean>(false);

  private readonly history = signal<ChalkHistoryState>(emptyChalkHistory);
  readonly canUndo = computed(() => this.history().past.length > 0);
  readonly canRedo = computed(() => this.history().future.length > 0);
  readonly canClear = computed(() => {
    const id = this.activeLayerId();
    const layer = this.layers().find((l) => l.id === id);
    return (layer?.strokes.length ?? 0) > 0;
  });

  constructor() {
    effect(() => {
      this.entityId();
      this.history.set(emptyChalkHistory);
    });
  }

  toggleLayers(): void {
    this.layersOpen.update((v) => !v);
  }

  undo(): void {
    const step = undoChalkHistory(this.history(), this.layers());
    if (!step) return;
    this.history.set(step.history);
    this.layersChange.emit(step.layers);
  }

  redo(): void {
    const step = redoChalkHistory(this.history(), this.layers());
    if (!step) return;
    this.history.set(step.history);
    this.layersChange.emit(step.layers);
  }

  clearActive(): void {
    const id = this.activeLayerId();
    if (!id) return;
    this.commit(clearLayer(this.layers(), id));
  }

  exportData(): ChalkExportData | null {
    return this.board()?.exportData() ?? null;
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

  private commit(next: readonly ChalkLayer[]): void {
    this.history.update((h) => recordChalkHistory(h, this.layers()));
    this.layersChange.emit(next);
  }

  private defaultLayerName(currentCount: number): string {
    return this.i18n.t('chalk.layerDefault').replace('{n}', String(currentCount + 1));
  }
}
