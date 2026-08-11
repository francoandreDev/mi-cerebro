import type { ElementRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import type { ChalkColorId, ChalkLayer, ChalkSize, ChalkStroke, ChalkTool } from './chalk.types';
import { CHALK_COLORS, CHALK_SIZE_PX } from './chalk.types';
import { buildChalkExportSvg, pointsToPath, strokeOpacity } from './chalk.utils';

export interface ChalkExportData {
  readonly svg: string;
  readonly width: number;
  readonly height: number;
}

interface RenderableStroke {
  readonly id: string;
  readonly d: string;
  readonly stroke: string;
  readonly widthPx: number;
  readonly opacity: number;
}

@Component({
  selector: 'mc-chalk-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chalk-board.component.html',
  styleUrl: './chalk-board.component.css',
})
export class ChalkBoardComponent {
  readonly layers = input.required<readonly ChalkLayer[]>();
  readonly active = input<boolean>(false);
  readonly tool = input<ChalkTool>('chalk');
  readonly color = input<ChalkColorId>('white');
  readonly size = input<ChalkSize>('m');

  readonly strokeFinished = output<ChalkStroke>();
  readonly erasePoint = output<{
    point: readonly [number, number];
    widthPx: number;
    heightPx: number;
  }>();

  protected readonly svg = viewChild<ElementRef<SVGSVGElement>>('svg');

  protected readonly renderedLayers = computed(() =>
    this.layers()
      .filter((l) => l.visible)
      .map((l) => ({
        id: l.id,
        strokes: l.strokes.map((s) => this.toRenderable(s)),
      })),
  );

  protected readonly previewPath = signal<string>('');
  protected readonly previewStrokePx = computed(() => CHALK_SIZE_PX[this.size()]);
  protected readonly previewColorHex = computed(
    () => CHALK_COLORS.find((c) => c.id === this.color())?.hex ?? '#f1f5d8',
  );

  private drawingId: number | null = null;
  private points: [number, number][] = [];

  protected onPointerDown(event: PointerEvent): void {
    if (!this.active()) return;
    const svg = this.svg()?.nativeElement;
    if (!svg) return;
    svg.setPointerCapture(event.pointerId);
    this.drawingId = event.pointerId;
    this.points = [this.toNormalized(event, svg)];
    if (this.tool() === 'eraser') this.emitErase(event, svg);
    event.preventDefault();
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.active() || this.drawingId !== event.pointerId) return;
    const svg = this.svg()?.nativeElement;
    if (!svg) return;
    const pt = this.toNormalized(event, svg);
    this.points.push(pt);
    if (this.tool() === 'eraser') {
      this.emitErase(event, svg);
    } else {
      this.previewPath.set(pointsToPath(this.points));
    }
  }

  protected onPointerUp(event: PointerEvent): void {
    if (this.drawingId !== event.pointerId) return;
    const svg = this.svg()?.nativeElement;
    if (svg) svg.releasePointerCapture(event.pointerId);
    this.drawingId = null;
    if (this.tool() === 'chalk' && this.points.length >= 2) {
      this.strokeFinished.emit({
        id: crypto.randomUUID(),
        color: this.color(),
        size: this.size(),
        points: this.points.slice(),
      });
    }
    this.points = [];
    this.previewPath.set('');
  }

  exportData(): ChalkExportData | null {
    const svgEl = this.svg()?.nativeElement;
    if (!svgEl) return null;
    const rect = svgEl.getBoundingClientRect();
    const width = rect.width || 1;
    const height = rect.height || 1;
    return { svg: buildChalkExportSvg(this.layers(), width, height), width, height };
  }

  private toRenderable(stroke: ChalkStroke): RenderableStroke {
    return {
      id: stroke.id,
      d: pointsToPath(stroke.points),
      stroke: CHALK_COLORS.find((c) => c.id === stroke.color)?.hex ?? '#f1f5d8',
      widthPx: CHALK_SIZE_PX[stroke.size],
      opacity: strokeOpacity(stroke.id),
    };
  }

  private toNormalized(event: PointerEvent, svg: SVGSVGElement): [number, number] {
    const rect = svg.getBoundingClientRect();
    const w = rect.width || 1;
    const h = rect.height || 1;
    return [clamp01((event.clientX - rect.left) / w), clamp01((event.clientY - rect.top) / h)];
  }

  private emitErase(event: PointerEvent, svg: SVGSVGElement): void {
    const rect = svg.getBoundingClientRect();
    const point = this.toNormalized(event, svg);
    this.erasePoint.emit({ point, widthPx: rect.width || 1, heightPx: rect.height || 1 });
  }
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);
