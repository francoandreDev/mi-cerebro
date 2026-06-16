import { Injectable, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';

import { parseDetailUrl } from './kind-routes';
import { SearchIndexService } from './search-index.service';
import type { EntityKind } from './search.types';

const STORAGE_KEY = 'mc.palette.recents.v1';
const MAX_RECENTS = 10;

export interface PaletteRecent {
  readonly kind: EntityKind;
  readonly id: string;
  readonly title: string;
  readonly visitedAt: number;
}

// why: tracks recently visited entities so the command palette can show
//      a "Recientes" section when the query is empty (§19.16a-ii).
//      Persisted as plain JSON in localStorage; failures swallow to no-op.
@Injectable({ providedIn: 'root' })
export class PaletteRecentsService {
  private readonly router = inject(Router);
  private readonly searchIndex = inject(SearchIndexService);
  private readonly recentsSignal = signal<readonly PaletteRecent[]>(this.load());
  private started = false;

  readonly recents = computed(() => this.recentsSignal());

  start(): void {
    if (this.started) return;
    this.started = true;
    this.router.events.subscribe((evt) => {
      if (evt instanceof NavigationEnd) this.track(evt.urlAfterRedirects);
    });
  }

  forget(id: string): void {
    this.recentsSignal.update((list) => {
      const next = list.filter((r) => r.id !== id);
      this.persist(next);
      return next;
    });
  }

  clear(): void {
    this.recentsSignal.set([]);
    this.persist([]);
  }

  private track(url: string): void {
    const ref = parseDetailUrl(url);
    if (!ref) return;
    const title = this.searchIndex.getTitle(ref.id) ?? '';
    const entry: PaletteRecent = {
      kind: ref.kind,
      id: ref.id,
      title,
      visitedAt: Date.now(),
    };
    this.recentsSignal.update((list) => {
      const filtered = list.filter((r) => r.id !== ref.id);
      const next = [entry, ...filtered].slice(0, MAX_RECENTS);
      this.persist(next);
      return next;
    });
  }

  private load(): readonly PaletteRecent[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((e): e is PaletteRecent => {
          if (!e || typeof e !== 'object') return false;
          const o = e as Record<string, unknown>;
          return (
            typeof o['kind'] === 'string' &&
            typeof o['id'] === 'string' &&
            typeof o['title'] === 'string' &&
            typeof o['visitedAt'] === 'number'
          );
        })
        .slice(0, MAX_RECENTS);
    } catch {
      return [];
    }
  }

  private persist(list: readonly PaletteRecent[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      /* no-op */
    }
  }
}
