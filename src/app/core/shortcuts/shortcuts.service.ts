import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

import type { ShortcutBinding } from './shortcuts.types';

function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
}

const MOD_ALIASES = new Set(['ctrl', 'control', 'cmd', 'command', 'meta']);

function matches(combo: string, event: KeyboardEvent): boolean {
  const parts = combo.split('+').map((p) => p.trim().toLowerCase());
  const key = parts[parts.length - 1] ?? '';
  const wantMod = parts.slice(0, -1).some((p) => MOD_ALIASES.has(p));
  const wantShift = parts.slice(0, -1).includes('shift');
  const wantAlt = parts.slice(0, -1).includes('alt');
  if (wantMod !== (event.ctrlKey || event.metaKey)) return false;
  if (wantAlt !== event.altKey) return false;
  if (wantShift && !event.shiftKey) return false;
  return event.key.toLowerCase() === key;
}

@Injectable({ providedIn: 'root' })
export class ShortcutsService {
  private readonly bindingsSignal = signal<readonly ShortcutBinding[]>([]);
  readonly bindings = computed(() => this.bindingsSignal());

  constructor() {
    document.addEventListener('keydown', this.onKey, { capture: true });
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('keydown', this.onKey, { capture: true });
    });
  }

  register(binding: ShortcutBinding): () => void {
    this.bindingsSignal.update((list) => [...list, binding]);
    return () => {
      this.bindingsSignal.update((list) => list.filter((b) => b !== binding));
    };
  }

  private readonly onKey = (event: KeyboardEvent): void => {
    for (const b of this.bindingsSignal()) {
      if (!matches(b.combo, event)) continue;
      if (b.scope === 'editable-safe' && isEditable(event.target)) continue;
      event.preventDefault();
      b.handler(event);
      return;
    }
  };
}
