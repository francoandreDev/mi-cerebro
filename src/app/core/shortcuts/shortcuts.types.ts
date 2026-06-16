import type { TranslationKey } from '@core/i18n/i18n.types';

export type ShortcutScope = 'global' | 'editable-safe';

export interface ShortcutBinding {
  readonly combo: string;
  readonly labelKey: TranslationKey;
  readonly scope: ShortcutScope;
  readonly handler: (event: KeyboardEvent) => void;
}
