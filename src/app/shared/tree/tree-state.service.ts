import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'mc:tree:expanded';

@Injectable({ providedIn: 'root' })
export class TreeStateService {
  private readonly expandedSignal = signal<ReadonlySet<string>>(this.load());

  readonly expanded = this.expandedSignal.asReadonly();

  isExpanded(id: string): boolean {
    return this.expandedSignal().has(id);
  }

  toggle(id: string): void {
    const next = new Set(this.expandedSignal());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.expandedSignal.set(next);
    this.persist(next);
  }

  expandAll(ids: Iterable<string>): void {
    const next = new Set(this.expandedSignal());
    let dirty = false;
    for (const id of ids) {
      if (!next.has(id)) {
        next.add(id);
        dirty = true;
      }
    }
    if (dirty) {
      this.expandedSignal.set(next);
      this.persist(next);
    }
  }

  private load(): ReadonlySet<string> {
    if (typeof localStorage === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return new Set();
      return new Set(parsed.filter((x): x is string => typeof x === 'string'));
    } catch {
      return new Set();
    }
  }

  private persist(set: ReadonlySet<string>): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
    } catch {
      // why: quota or disabled storage — non-fatal, expanded state just won't persist
    }
  }
}
