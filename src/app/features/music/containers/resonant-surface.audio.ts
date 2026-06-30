// why: pure audio-analysis helpers for the resonant-surface canvas. Kept out
// of the container so the component stays under the §4.4 size limit and so
// these functions can be reasoned about (and eventually tested) without DOM.

export const RIPPLE_SPEED_PX_PER_S = 110;
export const RIPPLE_DECAY_PER_S = 0.55;
export const SPOKE_DECAY_PER_S = 1.8;

export const BASS_BIN_RANGE: readonly [number, number] = [0, 8];
export const MID_BIN_RANGE: readonly [number, number] = [24, 96];
export const TREBLE_BIN_RANGE: readonly [number, number] = [160, 384];

export const EMA_ALPHA = 0.06;
export const BASS_TRIGGER_MARGIN = 18;
export const BASS_TRIGGER_RATIO = 1.25;
export const TREBLE_TRIGGER_MARGIN = 12;
export const TREBLE_TRIGGER_RATIO = 1.35;
export const BASS_COOLDOWN_MS = 110;
export const TREBLE_COOLDOWN_MS = 60;

export const OSCILLOSCOPE_POINTS = 128;
export const BASE_RADIUS_FACTOR = 0.32;

export const bandAverage = (buf: Uint8Array, range: readonly [number, number]): number => {
  const start = Math.max(0, range[0]);
  const end = Math.min(buf.length, range[1]);
  if (end <= start) return 0;
  let sum = 0;
  for (let i = start; i < end; i++) sum += buf[i] ?? 0;
  return sum / (end - start);
};

export const ema = (prev: number, current: number): number => prev + EMA_ALPHA * (current - prev);

export const timeDomainPeak = (buf: Uint8Array): number => {
  let peak = 0;
  for (const v of buf) {
    const sample = Math.abs(v - 128);
    if (sample > peak) peak = sample;
  }
  return peak / 128;
};

export const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);

export interface Ripple {
  radius: number;
  alpha: number;
  width: number;
}

export interface Spoke {
  angle: number;
  length: number;
  alpha: number;
}

export const decideRipple = (bass: number, bassEMA: number): Ripple | null => {
  const threshold = bassEMA * BASS_TRIGGER_RATIO + BASS_TRIGGER_MARGIN;
  if (bass < threshold) return null;
  const intensity = clamp01((bass - threshold) / Math.max(20, 255 - threshold));
  return {
    radius: 0,
    alpha: 0.5 + intensity * 0.5,
    width: 1.2 + intensity * 3,
  };
};

export const decideSpokes = (treble: number, trebleEMA: number): Spoke[] | null => {
  const threshold = trebleEMA * TREBLE_TRIGGER_RATIO + TREBLE_TRIGGER_MARGIN;
  if (treble < threshold) return null;
  const intensity = clamp01((treble - threshold) / Math.max(20, 255 - threshold));
  const count = 2 + Math.floor(intensity * 4);
  const out: Spoke[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      angle: Math.random() * Math.PI * 2,
      length: 0.08 + intensity * 0.18,
      alpha: 0.5 + intensity * 0.4,
    });
  }
  return out;
};

export const advanceRipples = (ripples: Ripple[], dt: number, dpr: number): Ripple[] => {
  for (const r of ripples) {
    r.radius += RIPPLE_SPEED_PX_PER_S * dpr * dt;
    r.alpha -= RIPPLE_DECAY_PER_S * dt;
  }
  return ripples.filter((r) => r.alpha > 0.02);
};

export const advanceSpokes = (spokes: Spoke[], dt: number): Spoke[] => {
  for (const s of spokes) s.alpha -= SPOKE_DECAY_PER_S * dt;
  return spokes.filter((s) => s.alpha > 0.02);
};

export const withAlpha = (color: string, alpha: number): string => {
  const a = clamp01(alpha);
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
