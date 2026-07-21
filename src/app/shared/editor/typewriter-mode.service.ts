// why: typewriter mode is a TipTap-writing preference (keep the active
//      line centered + dim inactive paragraphs) — it only makes sense
//      wired into mc-editor's consumers (writings, book chapters), unlike
//      FocusModeService (core/focus-mode) which dims chrome on pages that
//      aren't necessarily an editor (goals wall, book nav rails, etc.).
//      Lives in shared/editor per docs/proyecto/reglas.md §4.3.

import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'mc.editor.typewriterMode.v1';

@Injectable({ providedIn: 'root' })
export class TypewriterModeService {
  private readonly state = signal(this.loadInitial());
  readonly active = this.state.asReadonly();

  toggle(): void {
    const next = !this.state();
    this.state.set(next);
    this.persist(next);
  }

  private loadInitial(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  private persist(value: boolean): void {
    try {
      localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
    } catch {
      // why: localStorage may be full/unavailable; silent — UX continues.
    }
  }
}
