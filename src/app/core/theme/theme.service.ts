import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';

import { SettingsService } from '@core/settings/settings.service';

import type { ResolvedTheme, ThemePreference } from './theme.types';
import { THEME_STORAGE_KEY } from './theme.types';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);
  private readonly settings = inject(SettingsService);

  private readonly systemPrefersDark = signal<boolean>(this.matchSystemDark());

  readonly preference = computed<ThemePreference>(() => this.settings.state().theme.override);
  readonly resolved = computed<ResolvedTheme>(() => {
    const pref = this.preference();
    if (pref === 'auto') {
      return this.systemPrefersDark() ? 'dark' : 'light';
    }
    return pref;
  });

  constructor() {
    this.migrateLegacyStorage();
    this.listenToSystemChanges();
    effect(() => this.apply(this.preference()));
  }

  setPreference(next: ThemePreference): void {
    this.settings.setThemeOverride(next);
  }

  private apply(pref: ThemePreference): void {
    const root = this.doc.documentElement;
    if (pref === 'auto') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', pref);
    }
  }

  // why: pre-11bis ThemeService stored its own `mc.theme` key. SettingsService
  //      now owns the override (so it travels in `.mi-cerebro/settings.json`).
  //      One-shot migration: if the legacy key exists and settings is still
  //      at default, lift it in; then drop the key either way.
  private migrateLegacyStorage(): void {
    const ls = this.doc.defaultView?.localStorage;
    if (!ls) return;
    const raw = ls.getItem(THEME_STORAGE_KEY);
    if (raw === 'light' || raw === 'dark') {
      if (this.settings.state().theme.override === 'auto') {
        this.settings.setThemeOverride(raw);
      }
    }
    ls.removeItem(THEME_STORAGE_KEY);
  }

  private matchSystemDark(): boolean {
    return this.doc.defaultView?.matchMedia('(prefers-color-scheme: dark)').matches ?? false;
  }

  private listenToSystemChanges(): void {
    const mql = this.doc.defaultView?.matchMedia('(prefers-color-scheme: dark)');
    mql?.addEventListener('change', (e) => this.systemPrefersDark.set(e.matches));
  }
}
