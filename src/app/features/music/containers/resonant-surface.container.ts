import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/i18n.types';
import { PlayerService } from '@core/music/player.service';

import {
  BASE_RADIUS_FACTOR,
  BASS_BIN_RANGE,
  BASS_COOLDOWN_MS,
  MID_BIN_RANGE,
  OSCILLOSCOPE_POINTS,
  TREBLE_BIN_RANGE,
  TREBLE_COOLDOWN_MS,
  advanceRipples,
  advanceSpokes,
  bandAverage,
  clamp01,
  decideRipple,
  decideSpokes,
  ema,
  timeDomainPeak,
  withAlpha,
  type Ripple,
  type Spoke,
} from './resonant-surface.audio';

@Component({
  selector: 'mc-resonant-surface',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './resonant-surface.container.html',
  styleUrl: './resonant-surface.container.css',
})
export class ResonantSurfaceContainer {
  private readonly player = inject(PlayerService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly analyser = this.player.analyser;
  protected readonly isPlaying = this.player.isPlaying;
  protected readonly hasAudioPipeline = signal(false);

  private ctx: CanvasRenderingContext2D | null = null;
  private dpr = 1;
  private timeBuf: Uint8Array<ArrayBuffer> | null = null;
  private freqBuf: Uint8Array<ArrayBuffer> | null = null;
  private ripples: Ripple[] = [];
  private spokes: Spoke[] = [];
  private rafId: number | null = null;
  private lastFrameAt = 0;
  private lastBassSpawnAt = 0;
  private lastTrebleSpawnAt = 0;
  private bassEMA = 0;
  private midEMA = 0;
  private trebleEMA = 0;
  private accentColor = '#7aa2ff';

  constructor() {
    effect(() => this.hasAudioPipeline.set(this.analyser() !== null));
    effect(() => {
      const a = this.analyser();
      if (a !== null && this.isPlaying()) this.startLoop(a);
      else this.stopLoop();
    });
    effect(() => {
      const canvas = this.canvasRef()?.nativeElement;
      if (!canvas) return;
      this.ctx = canvas.getContext('2d');
      this.readAccentColor();
      this.resizeCanvas();
      this.drawStatic();
    });

    const ro = new ResizeObserver(() => {
      this.resizeCanvas();
      if (this.rafId === null) this.drawStatic();
    });
    ro.observe(this.hostRef.nativeElement);
    this.destroyRef.onDestroy(() => {
      ro.disconnect();
      this.stopLoop();
    });
  }

  protected t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  private startLoop(analyser: AnalyserNode): void {
    if (this.timeBuf === null || this.timeBuf.length !== analyser.fftSize) {
      this.timeBuf = new Uint8Array(new ArrayBuffer(analyser.fftSize));
      this.freqBuf = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    }
    if (this.rafId !== null) return;
    this.lastFrameAt = performance.now();
    const tick = (now: number): void => {
      const dt = Math.min(0.05, (now - this.lastFrameAt) / 1000);
      this.lastFrameAt = now;
      this.drawFrame(analyser, dt, now);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.ripples = [];
    this.spokes = [];
    this.bassEMA = 0;
    this.midEMA = 0;
    this.trebleEMA = 0;
    this.drawStatic();
  }

  private resizeCanvas(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * this.dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * this.dpr));
  }

  private readAccentColor(): void {
    const accent = getComputedStyle(this.hostRef.nativeElement)
      .getPropertyValue('--mc-accent-primary')
      .trim();
    if (accent.length > 0) this.accentColor = accent;
  }

  private drawStatic(): void {
    const ctx = this.ctx;
    const canvas = this.canvasRef()?.nativeElement;
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!this.hasAudioPipeline()) return;
    const { cx, cy, baseR } = this.geometry(canvas);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = withAlpha(this.accentColor, 0.45);
    ctx.lineWidth = 1.5 * this.dpr;
    ctx.beginPath();
    ctx.arc(0, 0, baseR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawFrame(analyser: AnalyserNode, dt: number, now: number): void {
    const ctx = this.ctx;
    const canvas = this.canvasRef()?.nativeElement;
    if (!ctx || !canvas || this.timeBuf === null || this.freqBuf === null) return;

    analyser.getByteTimeDomainData(this.timeBuf);
    analyser.getByteFrequencyData(this.freqBuf);

    const { cx, cy, baseR, maxR } = this.geometry(canvas);
    const bass = bandAverage(this.freqBuf, BASS_BIN_RANGE);
    const mid = bandAverage(this.freqBuf, MID_BIN_RANGE);
    const treble = bandAverage(this.freqBuf, TREBLE_BIN_RANGE);
    this.bassEMA = ema(this.bassEMA, bass);
    this.midEMA = ema(this.midEMA, mid);
    this.trebleEMA = ema(this.trebleEMA, treble);
    const peak = timeDomainPeak(this.timeBuf);

    if (now - this.lastBassSpawnAt >= BASS_COOLDOWN_MS) {
      const r = decideRipple(bass, this.bassEMA);
      if (r !== null) {
        this.ripples.push(r);
        this.lastBassSpawnAt = now;
      }
    }
    if (now - this.lastTrebleSpawnAt >= TREBLE_COOLDOWN_MS) {
      const s = decideSpokes(treble, this.trebleEMA);
      if (s !== null) {
        this.spokes.push(...s);
        this.lastTrebleSpawnAt = now;
      }
    }
    this.ripples = advanceRipples(this.ripples, dt, this.dpr);
    this.spokes = advanceSpokes(this.spokes, dt);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(cx, cy);
    for (const r of this.ripples) {
      if (r.radius > maxR) continue;
      ctx.strokeStyle = withAlpha(this.accentColor, r.alpha * 0.55);
      ctx.lineWidth = r.width * this.dpr;
      ctx.beginPath();
      ctx.arc(0, 0, r.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    this.drawOscilloscope(ctx, baseR, peak, mid);
    this.drawSpokes(ctx, baseR);
    ctx.restore();
  }

  // why: wobble tracks the real peak amplitude of this frame so volume
  // changes are visible 1:1; mid energy thickens the line so a vocal/lead
  // shows up distinctly from a bass-only signal.
  private drawOscilloscope(
    ctx: CanvasRenderingContext2D,
    baseR: number,
    peak: number,
    mid: number,
  ): void {
    const buf = this.timeBuf;
    if (buf === null) return;
    const step = Math.max(1, Math.floor(buf.length / OSCILLOSCOPE_POINTS));
    const wobble = baseR * (0.12 + peak * 0.7);
    const midNorm = clamp01(mid / 200);
    ctx.strokeStyle = withAlpha(this.accentColor, 0.6 + midNorm * 0.35);
    ctx.lineWidth = (1.5 + midNorm * 2.5) * this.dpr;
    ctx.beginPath();
    for (let i = 0; i < OSCILLOSCOPE_POINTS; i++) {
      const sample = (buf[i * step] ?? 128) - 128;
      const r = baseR + (sample / 128) * wobble;
      const angle = (i / OSCILLOSCOPE_POINTS) * Math.PI * 2;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  private drawSpokes(ctx: CanvasRenderingContext2D, baseR: number): void {
    if (this.spokes.length === 0) return;
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.5 * this.dpr;
    for (const s of this.spokes) {
      const inner = baseR * 1.05;
      const outer = baseR * (1.05 + s.length);
      const cx = Math.cos(s.angle);
      const sy = Math.sin(s.angle);
      ctx.strokeStyle = withAlpha(this.accentColor, s.alpha);
      ctx.beginPath();
      ctx.moveTo(cx * inner, sy * inner);
      ctx.lineTo(cx * outer, sy * outer);
      ctx.stroke();
    }
  }

  private geometry(canvas: HTMLCanvasElement): {
    cx: number;
    cy: number;
    baseR: number;
    maxR: number;
  } {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const minSide = Math.min(canvas.width, canvas.height);
    return { cx, cy, baseR: minSide * BASE_RADIUS_FACTOR, maxR: Math.hypot(cx, cy) };
  }
}
