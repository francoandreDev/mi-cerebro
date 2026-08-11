import {
  ChangeDetectionStrategy,
  Component,
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

import { ChalkSurfaceComponent } from './chalk-surface.component';
import type { ChalkColorId, ChalkLayer, ChalkSize, ChalkTool } from './chalk.types';
import { registerChalkShortcuts } from './chalk-shortcuts';
import type { ChalkExportFormat } from './chalk-toolbar.component';
import { ChalkToolbarComponent } from './chalk-toolbar.component';
import { chalkExportFilename } from './chalk.utils';

// why: wrapper delgado para /lists — la lógica de capas/historial/panel
//      vive en ChalkSurfaceComponent (ver docs/proyecto/features.md); este
//      componente solo mantiene el estado de herramienta activa/color/
//      grosor y el toolbar, que en listas es 1:1 con la única superficie.
//      Libros orquesta lo mismo a mano con dos ChalkSurfaceComponent y un
//      solo toolbar compartido (ver ChapterEditorPaneComponent).
@Component({
  selector: 'mc-chalkboard-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChalkSurfaceComponent, ChalkToolbarComponent],
  templateUrl: './chalkboard-overlay.component.html',
  styleUrl: './chalkboard-overlay.component.css',
})
export class ChalkboardOverlayComponent {
  readonly layers = input.required<readonly ChalkLayer[]>();
  readonly editable = input<boolean>(true);
  readonly entityTitle = input<string>('');
  readonly entityId = input<string>('');

  readonly layersChange = output<readonly ChalkLayer[]>();

  private readonly i18n = inject(I18nService);
  private readonly surface = viewChild(ChalkSurfaceComponent);

  protected readonly active = signal<boolean>(false);
  protected readonly tool = signal<ChalkTool>('chalk');
  protected readonly color = signal<ChalkColorId>('white');
  protected readonly size = signal<ChalkSize>('m');

  constructor() {
    registerChalkShortcuts({
      toggleMode: () => this.onToggleActive(),
      pickChalk: () => this.active() && this.tool.set('chalk'),
      pickEraser: () => this.active() && this.tool.set('eraser'),
      pickColor: (c) => this.active() && this.color.set(c),
      undo: () => this.active() && this.surface()?.undo(),
      redo: () => this.active() && this.surface()?.redo(),
    });
  }

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  protected onToggleActive(): void {
    if (!this.editable()) return;
    this.active.update((v) => !v);
  }

  protected onLayersChange(layers: readonly ChalkLayer[]): void {
    this.layersChange.emit(layers);
  }

  protected onUndo(): void {
    this.surface()?.undo();
  }

  protected onRedo(): void {
    this.surface()?.redo();
  }

  protected onClearActive(): void {
    this.surface()?.clearActive();
  }

  protected onToggleLayers(): void {
    this.surface()?.toggleLayers();
  }

  protected canUndo(): boolean {
    return this.surface()?.canUndo() ?? false;
  }

  protected canRedo(): boolean {
    return this.surface()?.canRedo() ?? false;
  }

  protected canClear(): boolean {
    return this.surface()?.canClear() ?? false;
  }

  protected layersOpen(): boolean {
    return this.surface()?.layersOpen() ?? false;
  }

  protected async onExportBoard(format: ChalkExportFormat): Promise<void> {
    const data = this.surface()?.exportData();
    if (!data) return;
    const filename = chalkExportFilename(this.entityTitle() || this.t('chalk.export'), format);
    if (format === 'svg') {
      triggerDownload(new Blob([data.svg], { type: 'image/svg+xml' }), filename);
      return;
    }
    const png = await svgToPngBlob(data.svg, data.width, data.height);
    triggerDownload(png, filename);
  }
}
