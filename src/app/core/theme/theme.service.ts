import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

import type { ResolvedTheme, ThemePreference } from './theme.types';
import { THEME_STORAGE_KEY } from './theme.types';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);

  private readonly preferenceSignal = signal<ThemePreference>(this.readStored());
  private readonly systemPrefersDark = signal<boolean>(this.matchSystemDark());

  readonly preference = this.preferenceSignal.asReadonly();
  readonly resolved = computed<ResolvedTheme>(() => {
    const pref = this.preferenceSignal();
    if (pref === 'auto') {
      return this.systemPrefersDark() ? 'dark' : 'light';
    }
    return pref;
  });

  constructor() {
    this.listenToSystemChanges();
    this.apply(this.preferenceSignal());
  }

  setPreference(next: ThemePreference): void {
    this.preferenceSignal.set(next);
    if (next === 'auto') {
      this.doc.defaultView?.localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      this.doc.defaultView?.localStorage.setItem(THEME_STORAGE_KEY, next);
    }
    this.apply(next);
  }

  private apply(pref: ThemePreference): void {
    const root = this.doc.documentElement;
    if (pref === 'auto') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', pref);
    }
  }

  private readStored(): ThemePreference {
    const raw = this.doc.defaultView?.localStorage.getItem(THEME_STORAGE_KEY);
    return raw === 'light' || raw === 'dark' ? raw : 'auto';
  }

  private matchSystemDark(): boolean {
    return this.doc.defaultView?.matchMedia('(prefers-color-scheme: dark)').matches ?? false;
  }

  private listenToSystemChanges(): void {
    const mql = this.doc.defaultView?.matchMedia('(prefers-color-scheme: dark)');
    mql?.addEventListener('change', (e) => this.systemPrefersDark.set(e.matches));
  }
}
