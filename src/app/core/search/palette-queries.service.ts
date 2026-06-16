import { Injectable, computed, signal } from '@angular/core';

const STORAGE_KEY = 'mc.palette.queries.v1';
const MAX_QUERIES = 10;

export interface PaletteQuery {
  readonly text: string;
  readonly usedAt: number;
}

// why: persists the last text queries entered in the command palette so the
//      user can re-run a previous search (§19.16a-iii). The hit is only saved
//      when the user navigates to a result — typing alone does not record.
@Injectable({ providedIn: 'root' })
export class PaletteQueriesService {
  private readonly queriesSignal = signal<readonly PaletteQuery[]>(this.load());

  readonly queries = computed(() => this.queriesSignal());

  remember(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    const entry: PaletteQuery = { text: trimmed, usedAt: Date.now() };
    this.queriesSignal.update((list) => {
      const filtered = list.filter((q) => q.text !== trimmed);
      const next = [entry, ...filtered].slice(0, MAX_QUERIES);
      this.persist(next);
      return next;
    });
  }

  forget(text: string): void {
    this.queriesSignal.update((list) => {
      const next = list.filter((q) => q.text !== text);
      this.persist(next);
      return next;
    });
  }

  private load(): readonly PaletteQuery[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((e): e is PaletteQuery => {
          if (!e || typeof e !== 'object') return false;
          const o = e as Record<string, unknown>;
          return typeof o['text'] === 'string' && typeof o['usedAt'] === 'number';
        })
        .slice(0, MAX_QUERIES);
    } catch {
      return [];
    }
  }

  private persist(list: readonly PaletteQuery[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      /* no-op */
    }
  }
}
