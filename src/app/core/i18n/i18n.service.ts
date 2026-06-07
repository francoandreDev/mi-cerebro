import { Injectable, signal } from '@angular/core';

import { es } from './locales/es';
import type { Locale, TranslationKey, TranslationParams } from './i18n.types';

const DICTS: Record<Locale, Record<TranslationKey, string>> = {
  es,
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly localeSignal = signal<Locale>('es');
  readonly locale = this.localeSignal.asReadonly();

  setLocale(locale: Locale): void {
    this.localeSignal.set(locale);
  }

  t(key: TranslationKey, params?: TranslationParams): string {
    const raw = DICTS[this.localeSignal()][key];
    return params ? this.interpolate(raw, params) : raw;
  }

  private interpolate(raw: string, params: TranslationParams): string {
    return raw.replace(/\{(\w+)\}/g, (_, name: string) => {
      const value = params[name];
      return value === undefined ? `{${name}}` : String(value);
    });
  }
}
