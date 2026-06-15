import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';

import { SettingsService } from '@core/settings/settings.service';

import {
  ACCENT_FG,
  BG_SAT_LEVELS,
  accentHexFor,
  computeBgHex,
  deriveBgScale,
} from './theme-palette';
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
    effect(() => this.applyCustomTokens(this.resolved(), this.settings.state().theme));
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

  private applyCustomTokens(
    theme: ResolvedTheme,
    cfg: {
      customBgHue?: number;
      customBgSatLevel?: 'low' | 'mid' | 'high';
      customAccentId?: string;
    },
  ): void {
    const root = this.doc.documentElement;
    const props = customCssVars(theme, cfg);
    if (props === null) {
      // Reset any previously applied overrides.
      for (const name of CUSTOM_PROP_NAMES) root.style.removeProperty(name);
      return;
    }
    for (const [k, v] of Object.entries(props)) root.style.setProperty(k, v);
  }

  private matchSystemDark(): boolean {
    return this.doc.defaultView?.matchMedia('(prefers-color-scheme: dark)').matches ?? false;
  }

  private listenToSystemChanges(): void {
    const mql = this.doc.defaultView?.matchMedia('(prefers-color-scheme: dark)');
    mql?.addEventListener('change', (e) => this.systemPrefersDark.set(e.matches));
  }
}

const CUSTOM_PROP_NAMES = [
  '--mc-bg-base',
  '--mc-bg-surface',
  '--mc-bg-elevated',
  '--mc-bg-hover',
  '--mc-bg-selected',
  '--mc-accent-primary',
  '--mc-accent-hover',
  '--mc-accent-active',
  '--mc-accent-fg',
] as const;

function customCssVars(
  theme: ResolvedTheme,
  cfg: { customBgHue?: number; customBgSatLevel?: 'low' | 'mid' | 'high'; customAccentId?: string },
): Record<string, string> | null {
  const out: Record<string, string> = {};
  if (cfg.customBgHue !== undefined || cfg.customBgSatLevel !== undefined) {
    const hue = cfg.customBgHue ?? (theme === 'dark' ? 215 : 43);
    const sat = cfg.customBgSatLevel ?? 'mid';
    const base = computeBgHex(theme, hue, sat);
    const scale = deriveBgScale(theme, base, hue, sat);
    out['--mc-bg-base'] = scale.base;
    out['--mc-bg-surface'] = scale.surface;
    out['--mc-bg-elevated'] = scale.elevated;
    out['--mc-bg-hover'] = scale.hover;
    out['--mc-bg-selected'] = scale.selected;
    void BG_SAT_LEVELS;
  }
  if (cfg.customAccentId !== undefined) {
    const accent = accentHexFor(theme, cfg.customAccentId);
    out['--mc-accent-primary'] = accent;
    out['--mc-accent-hover'] = accent;
    out['--mc-accent-active'] = accent;
    out['--mc-accent-fg'] = ACCENT_FG[theme];
  }
  return Object.keys(out).length === 0 ? null : out;
}
