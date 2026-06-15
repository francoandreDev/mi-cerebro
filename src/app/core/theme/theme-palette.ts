// Curated palettes for theme customization (paso 15).
// All entries are pre-validated for WCAG AA in the corresponding spec.

import type { ResolvedTheme } from './theme.types';
import { contrastHex, hslToHex } from './wcag';

export type BgSatLevel = 'low' | 'mid' | 'high';

export interface AccentSwatch {
  readonly id: string;
  readonly nameKey: `theme.accent.${string}`;
  readonly light: string;
  readonly dark: string;
}

export interface TagSwatch {
  readonly id: string;
  readonly light: string;
  readonly dark: string;
}

// Locked lightness per theme so contrast ratio against fg never collapses.
export const BG_LIGHTNESS: Record<ResolvedTheme, number> = {
  light: 0.78,
  dark: 0.085,
};

// Curated sat options. Low ≈ near-grey, high ≈ tinted but not vibrant.
export const BG_SAT_LEVELS: Record<BgSatLevel, number> = {
  low: 0.04,
  mid: 0.14,
  high: 0.26,
};

// Default hue per theme (matches the original beige/navy bias in _tokens.scss).
export const DEFAULT_BG_HUE: Record<ResolvedTheme, number> = {
  light: 43,
  dark: 215,
};

export function computeBgHex(theme: ResolvedTheme, hue: number, sat: BgSatLevel): string {
  const l = BG_LIGHTNESS[theme];
  const s = BG_SAT_LEVELS[sat];
  return hslToHex(normalizeHue(hue), s, l);
}

// Derives bg-surface/elevated/hover from base. Same hue+sat, shifted L.
export function deriveBgScale(
  theme: ResolvedTheme,
  baseHex: string,
  hue: number,
  sat: BgSatLevel,
): {
  base: string;
  surface: string;
  elevated: string;
  hover: string;
  selected: string;
} {
  const h = normalizeHue(hue);
  const s = BG_SAT_LEVELS[sat];
  const baseL = BG_LIGHTNESS[theme];
  const sign = theme === 'light' ? -1 : 1;
  return {
    base: baseHex,
    surface: hslToHex(h, s, clampL(baseL + sign * 0.06)),
    elevated: hslToHex(h, s, clampL(baseL + -sign * 0.04)),
    hover: hslToHex(h, s, clampL(baseL + sign * 0.1)),
    selected: hslToHex(h, Math.min(0.4, s + 0.2), clampL(baseL + sign * 0.05)),
  };
}

function clampL(v: number): number {
  return Math.max(0.02, Math.min(0.98, v));
}

function normalizeHue(h: number): number {
  const n = h % 360;
  return n < 0 ? n + 360 : n;
}

// Accents: 12 curated swatches. Light variant darker than dark variant so
// white text reads on both. Pre-validated in theme-palette.spec.
export const ACCENT_PALETTE: readonly AccentSwatch[] = Object.freeze([
  { id: 'red', nameKey: 'theme.accent.red', light: '#b32020', dark: '#ff6b6b' },
  { id: 'orange', nameKey: 'theme.accent.orange', light: '#a8430a', dark: '#ff8a4a' },
  { id: 'amber', nameKey: 'theme.accent.amber', light: '#8a5a00', dark: '#f0b94e' },
  { id: 'lime', nameKey: 'theme.accent.lime', light: '#4a6f00', dark: '#a8d35a' },
  { id: 'green', nameKey: 'theme.accent.green', light: '#1f7a32', dark: '#56c272' },
  { id: 'teal', nameKey: 'theme.accent.teal', light: '#057079', dark: '#3fc8d2' },
  { id: 'cyan', nameKey: 'theme.accent.cyan', light: '#066b8e', dark: '#5cc3e8' },
  { id: 'blue', nameKey: 'theme.accent.blue', light: '#1a5fb8', dark: '#6aaeff' },
  { id: 'indigo', nameKey: 'theme.accent.indigo', light: '#3b3fa3', dark: '#8a90f0' },
  { id: 'violet', nameKey: 'theme.accent.violet', light: '#6938b8', dark: '#b18cf0' },
  { id: 'magenta', nameKey: 'theme.accent.magenta', light: '#9c2a8a', dark: '#e07ad0' },
  { id: 'rose', nameKey: 'theme.accent.rose', light: '#a8235e', dark: '#f07ab0' },
]);

export const DEFAULT_ACCENT_ID = 'orange';

// Accent fg chosen per-theme so contrast(accent, fg) ≥ 4.5.
// For light variants (darker), fg = white. For dark variants (brighter), fg = near-black.
export const ACCENT_FG: Record<ResolvedTheme, string> = {
  light: '#ffffff',
  dark: '#1a0f08',
};

export function findAccent(id: string | undefined): AccentSwatch {
  if (!id) return ACCENT_PALETTE[0]!;
  return (
    ACCENT_PALETTE.find((a) => a.id === id) ??
    ACCENT_PALETTE.find((a) => a.id === DEFAULT_ACCENT_ID)!
  );
}

export function accentHexFor(theme: ResolvedTheme, id: string | undefined): string {
  const sw = findAccent(id);
  return theme === 'dark' ? sw.dark : sw.light;
}

// Tag palette: 12 curated swatches, each ≥ 3:1 non-text contrast vs both
// light and dark bg (validated in spec).
export const TAG_SWATCHES: readonly TagSwatch[] = Object.freeze([
  { id: 'red', light: '#a82828', dark: '#ff7a7a' },
  { id: 'orange', light: '#a04a14', dark: '#ff9a55' },
  { id: 'amber', light: '#7a5400', dark: '#f0c25a' },
  { id: 'lime', light: '#4d6a0a', dark: '#b8d860' },
  { id: 'green', light: '#1f7a32', dark: '#6cd080' },
  { id: 'teal', light: '#0a6a72', dark: '#5cd2dc' },
  { id: 'cyan', light: '#0a6080', dark: '#6acce8' },
  { id: 'blue', light: '#2055a8', dark: '#7ab2ff' },
  { id: 'indigo', light: '#3a3aa0', dark: '#9698f0' },
  { id: 'violet', light: '#5a30a8', dark: '#b890ee' },
  { id: 'magenta', light: '#8a2880', dark: '#e082c8' },
  { id: 'rose', light: '#9a2058', dark: '#f080a8' },
]);

export function findTagSwatch(id: string | undefined): TagSwatch | null {
  if (!id) return null;
  return TAG_SWATCHES.find((s) => s.id === id) ?? null;
}

export function tagHexFor(theme: ResolvedTheme, id: string | undefined): string | null {
  const sw = findTagSwatch(id);
  if (!sw) return null;
  return theme === 'dark' ? sw.dark : sw.light;
}

export interface ContrastReport {
  readonly ratio: number;
  readonly passesAA: boolean;
  readonly passesAAA: boolean;
}

export function reportContrast(aHex: string, bHex: string): ContrastReport {
  const ratio = contrastHex(aHex, bHex);
  return {
    ratio,
    passesAA: ratio >= 4.5,
    passesAAA: ratio >= 7,
  };
}
