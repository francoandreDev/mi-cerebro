// Curated highlight-mark palette (§19.16e-i). Closed set, same philosophy
// as ACCENT_PALETTE/TAG_SWATCHES (§15): no free-form hex, every entry
// pre-validated for WCAG AA against body text in both themes so a
// highlighted passage never becomes unreadable.

import type { ResolvedTheme } from './theme.types';

export interface HighlightSwatch {
  readonly id: string;
  readonly nameKey: `editor.highlight.color.${string}`;
  readonly light: string;
  readonly dark: string;
}

export const HIGHLIGHT_SWATCHES: readonly HighlightSwatch[] = Object.freeze([
  { id: 'yellow', nameKey: 'editor.highlight.color.yellow', light: '#d6c985', dark: '#6a6239' },
  { id: 'green', nameKey: 'editor.highlight.color.green', light: '#85d692', dark: '#396a41' },
  { id: 'blue', nameKey: 'editor.highlight.color.blue', light: '#85add6', dark: '#39526a' },
  { id: 'rose', nameKey: 'editor.highlight.color.rose', light: '#d685a0', dark: '#6a3949' },
  { id: 'violet', nameKey: 'editor.highlight.color.violet', light: '#b485d6', dark: '#56396a' },
]);

export function findHighlightSwatch(id: string | undefined): HighlightSwatch | null {
  if (!id) return null;
  return HIGHLIGHT_SWATCHES.find((s) => s.id === id) ?? null;
}

export function highlightHexFor(theme: ResolvedTheme, id: string | undefined): string | null {
  const sw = findHighlightSwatch(id);
  if (!sw) return null;
  return theme === 'dark' ? sw.dark : sw.light;
}
