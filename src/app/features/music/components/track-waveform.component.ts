import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

type WaveformStatus = 'idle' | 'loading' | 'ready' | 'failed';

@Component({
  selector: 'mc-track-waveform',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './track-waveform.component.html',
  styleUrl: './track-waveform.component.css',
})
export class TrackWaveformComponent {
  readonly peaks = input<Float32Array | null>(null);
  readonly currentTime = input<number>(0);
  readonly duration = input<number>(0);
  readonly status = input<WaveformStatus>('idle');
  readonly seek = output<number>();

  private readonly destroyRef = inject(DestroyRef);
  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  protected readonly hoverRatio = signal<number | null>(null);
  private dpr = 1;
  private dragging = false;
  private accentColor = '#7aa2ff';
  private mutedColor = '#999';

  constructor() {
    effect(() => {
      this.readColors();
      this.peaks();
      this.currentTime();
      this.duration();
      this.status();
      this.draw();
    });
    const ro = new ResizeObserver(() => {
      this.resizeCanvas();
      this.draw();
    });
    ro.observe(this.hostRef.nativeElement);
    this.destroyRef.onDestroy(() => ro.disconnect());
  }

  protected onPointerDown(ev: PointerEvent): void {
    this.dragging = true;
    (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
    this.emitSeekFromEvent(ev);
  }

  protected onPointerMove(ev: PointerEvent): void {
    const ratio = this.ratioFromEvent(ev);
    this.hoverRatio.set(ratio);
    if (this.dragging) this.emitSeekFromEvent(ev);
  }

  protected onPointerUp(ev: PointerEvent): void {
    if (!this.dragging) return;
    this.dragging = false;
    try {
      (ev.target as HTMLElement).releasePointerCapture(ev.pointerId);
    } catch {
      // why: capture may already be released by the browser; non-fatal.
    }
  }

  protected onPointerLeave(): void {
    this.hoverRatio.set(null);
  }

  @HostListener('window:resize')
  protected onWindowResize(): void {
    this.resizeCanvas();
    this.draw();
  }

  private emitSeekFromEvent(ev: PointerEvent): void {
    const ratio = this.ratioFromEvent(ev);
    if (ratio === null) return;
    const dur = this.duration();
    if (!Number.isFinite(dur) || dur <= 0) return;
    this.seek.emit(ratio * dur);
  }

  private ratioFromEvent(ev: PointerEvent): number | null {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const x = Math.min(Math.max(0, ev.clientX - rect.left), rect.width);
    return x / rect.width;
  }

  private resizeCanvas(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * this.dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * this.dpr));
  }

  private readColors(): void {
    const css = getComputedStyle(this.hostRef.nativeElement);
    const accent = css.getPropertyValue('--mc-accent-primary').trim();
    if (accent.length > 0) this.accentColor = accent;
    const muted = css.getPropertyValue('--mc-fg-muted').trim();
    if (muted.length > 0) this.mutedColor = muted;
  }

  private draw(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (canvas.width === 0 || canvas.height === 0) this.resizeCanvas();
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const peaks = this.peaks();
    const dur = this.duration();
    const progressRatio = dur > 0 ? Math.min(1, Math.max(0, this.currentTime() / dur)) : 0;

    if (peaks === null || peaks.length === 0) {
      this.drawFallbackBar(ctx, w, h, progressRatio);
      return;
    }

    const mid = h / 2;
    const barCount = peaks.length;
    const barW = w / barCount;
    const progressX = progressRatio * w;

    for (let i = 0; i < barCount; i++) {
      const v = peaks[i] ?? 0;
      const barH = Math.max(1 * this.dpr, v * h * 0.9);
      const x = i * barW;
      const cx = x + barW / 2;
      const past = cx <= progressX;
      ctx.fillStyle = past ? withAlpha(this.accentColor, 0.95) : withAlpha(this.mutedColor, 0.45);
      const thickness = Math.max(1 * this.dpr, barW * 0.65);
      ctx.fillRect(cx - thickness / 2, mid - barH / 2, thickness, barH);
    }

    ctx.fillStyle = withAlpha(this.accentColor, 0.85);
    ctx.fillRect(progressX - 1 * this.dpr, 0, 2 * this.dpr, h);
  }

  private drawFallbackBar(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    progressRatio: number,
  ): void {
    const trackY = h / 2 - 1 * this.dpr;
    ctx.fillStyle = withAlpha(this.mutedColor, 0.35);
    ctx.fillRect(0, trackY, w, 2 * this.dpr);
    ctx.fillStyle = withAlpha(this.accentColor, 0.85);
    ctx.fillRect(0, trackY, w * progressRatio, 2 * this.dpr);
  }
}

const withAlpha = (color: string, alpha: number): string => {
  const a = Math.min(1, Math.max(0, alpha));
  if (color.startsWith('#') && (color.length === 7 || color.length === 4)) {
    const hex =
      color.length === 4
        ? color
            .slice(1)
            .split('')
            .map((c) => c + c)
            .join('')
        : color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return `color-mix(in srgb, ${color} ${(a * 100).toFixed(1)}%, transparent)`;
};
