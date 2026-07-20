import { Injectable, inject } from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';

const LAST_ROUTE_KEY = 'mc.continuity.lastRoute.v1';
const SCROLL_KEY = 'mc.continuity.scroll.v1';
const SCROLL_CAP = 50;
const CONTENT_SELECTOR = '.content';

type ScrollMap = Record<string, number>;

// why: session continuity (§19.16a-i). lastRoute survives reloads in
//      localStorage; per-route scrollY lives only for the session.
//      All storage I/O is best-effort — failures fall back to no-op.
@Injectable({ providedIn: 'root' })
export class ContinuityService {
  private readonly router = inject(Router);
  private started = false;
  private currentUrl: string | null = null;
  // why: distinct from persisted lastRoute (which is "restore here on next
  //      boot", so it already points at /dashboard itself by the time
  //      /dashboard reads it). previousUrl is in-memory only, one step back
  //      in this session's navigation — what dashboard resurfacing needs to
  //      find "the entity the user was just looking at".
  private previousUrl: string | null = null;
  private scrollOrder: string[] = [];

  start(): void {
    if (this.started) return;
    this.started = true;
    this.scrollOrder = Object.keys(this.readScrollMap());
    this.router.events.subscribe((evt) => {
      if (evt instanceof NavigationStart) {
        this.captureScroll(this.currentUrl);
      } else if (evt instanceof NavigationEnd) {
        const url = evt.urlAfterRedirects;
        this.previousUrl = this.currentUrl;
        this.currentUrl = url;
        this.persistLastRoute(url);
        queueMicrotask(() => this.restoreScroll(url));
      }
    });
  }

  getLastRoute(): string | null {
    try {
      return localStorage.getItem(LAST_ROUTE_KEY);
    } catch {
      return null;
    }
  }

  getPreviousRoute(): string | null {
    return this.previousUrl;
  }

  private persistLastRoute(url: string): void {
    try {
      localStorage.setItem(LAST_ROUTE_KEY, url);
    } catch {
      /* no-op */
    }
  }

  private captureScroll(url: string | null): void {
    if (!url) return;
    const el = this.contentEl();
    if (!el) return;
    const map = this.readScrollMap();
    map[url] = el.scrollTop;
    this.touchOrder(url);
    this.writeScrollMap(map);
  }

  private restoreScroll(url: string): void {
    const el = this.contentEl();
    if (!el) return;
    const map = this.readScrollMap();
    const y = map[url];
    el.scrollTop = typeof y === 'number' ? y : 0;
  }

  private touchOrder(url: string): void {
    const idx = this.scrollOrder.indexOf(url);
    if (idx !== -1) this.scrollOrder.splice(idx, 1);
    this.scrollOrder.push(url);
    while (this.scrollOrder.length > SCROLL_CAP) {
      this.scrollOrder.shift();
    }
  }

  private readScrollMap(): ScrollMap {
    try {
      const raw = sessionStorage.getItem(SCROLL_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object') return parsed as ScrollMap;
      return {};
    } catch {
      return {};
    }
  }

  private writeScrollMap(map: ScrollMap): void {
    const trimmed: ScrollMap = {};
    for (const url of this.scrollOrder) {
      const v = map[url];
      if (typeof v === 'number') trimmed[url] = v;
    }
    try {
      sessionStorage.setItem(SCROLL_KEY, JSON.stringify(trimmed));
    } catch {
      /* no-op */
    }
  }

  private contentEl(): HTMLElement | null {
    return document.querySelector<HTMLElement>(CONTENT_SELECTOR);
  }
}
