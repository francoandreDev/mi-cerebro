// WCAG 2.1 contrast utilities. Pure functions; no DOM.
// Formula: https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export type WcagLevel = 'fail' | 'AA' | 'AAA';

export function parseHex(hex: string): Rgb | null {
  const m = hex.trim().replace(/^#/, '');
  if (m.length === 3) {
    const r = parseInt(m[0]! + m[0]!, 16);
    const g = parseInt(m[1]! + m[1]!, 16);
    const b = parseInt(m[2]! + m[2]!, 16);
    if ([r, g, b].some(Number.isNaN)) return null;
    return { r, g, b };
  }
  if (m.length === 6) {
    const r = parseInt(m.slice(0, 2), 16);
    const g = parseInt(m.slice(2, 4), 16);
    const b = parseInt(m.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) return null;
    return { r, g, b };
  }
  return null;
}

export function relativeLuminance(c: Rgb): number {
  const linear = (n: number): number => {
    const s = n / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linear(c.r) + 0.7152 * linear(c.g) + 0.0722 * linear(c.b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [lhi, llo] = la >= lb ? [la, lb] : [lb, la];
  return (lhi + 0.05) / (llo + 0.05);
}

export function contrastHex(aHex: string, bHex: string): number {
  const a = parseHex(aHex);
  const b = parseHex(bHex);
  if (!a || !b) return 0;
  return contrastRatio(a, b);
}

// AA: ≥ 4.5 normal text, ≥ 3 large/UI. AAA: ≥ 7.
// We use the normal-text thresholds because the user reads body copy with
// these tokens, not just chrome.
export function levelOf(ratio: number): WcagLevel {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  return 'fail';
}

// HSL → hex. h in [0,360), s and l in [0,1].
export function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number): string => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(color * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
