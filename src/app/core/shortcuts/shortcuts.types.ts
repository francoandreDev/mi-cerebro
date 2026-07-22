import type { TranslationKey } from '@core/i18n/i18n.types';

export type ShortcutScope = 'global' | 'editable-safe';

export interface ShortcutBinding {
  readonly combo: string;
  readonly labelKey: TranslationKey;
  readonly scope: ShortcutScope;
  readonly handler: (event: KeyboardEvent) => void;
  /**
   * Route slug (routePageId) this binding belongs to, e.g. 'history'.
   * Omit for combos that apply everywhere (Ctrl+K, Alt+N, etc.) — those
   * keep showing in the global/editable-safe groups on every page.
   */
  readonly pageScope?: string;
}
