import { Injectable, inject, signal, type Signal } from '@angular/core';

import { LockChannel } from './lock-channel';
import {
  LOCK_PONG_WAIT_MS,
  type LockMessage,
  type LockOutcome,
  type LockState,
} from './lock.types';

interface Entry {
  readonly state: ReturnType<typeof signal<LockState>>;
  ownerTabId: string | null;
}

// Why: cooperative locking via BroadcastChannel — every tab that wants to
//      edit an entity claims its key. Owners respond with pong; if no pong
//      arrives within LOCK_PONG_WAIT_MS, the claimant is granted. Releases
//      and takeovers propagate by broadcast.
@Injectable({ providedIn: 'root' })
export class LockService {
  readonly tabId: string = crypto.randomUUID();
  private readonly channel = inject(LockChannel);
  private readonly entries = new Map<string, Entry>();
  private readonly pongListeners = new Set<(msg: LockMessage) => void>();

  constructor() {
    this.channel.onMessage((msg) => this.handle(msg));
    // why: best-effort release on tab close; if it doesn't fire (crash) the
    //      next claimant will silently take over after the pong timeout.
    window.addEventListener('beforeunload', () => this.releaseAll());
  }

  state(kind: string, id: string): Signal<LockState> {
    return this.entry(this.keyOf(kind, id)).state.asReadonly();
  }

  ownerOf(kind: string, id: string): string | null {
    return this.entry(this.keyOf(kind, id)).ownerTabId;
  }

  async acquire(kind: string, id: string): Promise<LockOutcome> {
    const key = this.keyOf(kind, id);
    let conflict: string | null = null;
    const listener = (msg: LockMessage): void => {
      if (msg.type === 'pong' && msg.key === key && msg.tabId !== this.tabId) {
        conflict = msg.tabId;
      }
    };
    this.pongListeners.add(listener);
    this.channel.post({ type: 'claim', key, tabId: this.tabId });
    await this.wait(LOCK_PONG_WAIT_MS);
    this.pongListeners.delete(listener);

    const entry = this.entry(key);
    if (conflict !== null) {
      entry.ownerTabId = conflict;
      entry.state.set('foreign');
      return { granted: false, ownerTabId: conflict };
    }
    entry.ownerTabId = this.tabId;
    entry.state.set('owned');
    return { granted: true };
  }

  release(kind: string, id: string): void {
    const key = this.keyOf(kind, id);
    const entry = this.entry(key);
    if (entry.state() !== 'owned') return;
    entry.state.set('idle');
    entry.ownerTabId = null;
    this.channel.post({ type: 'release', key, tabId: this.tabId });
  }

  // why: optimistic — we claim ownership immediately and tell the previous
  //      owner to evict. If the network message is lost the worst case is
  //      both tabs think they own it; next save will collide on disk.
  takeover(kind: string, id: string): void {
    const key = this.keyOf(kind, id);
    const entry = this.entry(key);
    const previousOwner = entry.ownerTabId;
    entry.ownerTabId = this.tabId;
    entry.state.set('owned');
    if (previousOwner !== null && previousOwner !== this.tabId) {
      this.channel.post({ type: 'takeover', key, tabId: this.tabId, toTabId: previousOwner });
    }
  }

  // Acknowledge eviction (UI dismisses banner / leaves readonly).
  clearEviction(kind: string, id: string): void {
    const key = this.keyOf(kind, id);
    const entry = this.entries.get(key);
    if (entry?.state() === 'evicted') {
      entry.state.set('idle');
      entry.ownerTabId = null;
    }
  }

  private handle(msg: LockMessage): void {
    if (msg.tabId === this.tabId) return;
    switch (msg.type) {
      case 'claim':
        this.onClaim(msg);
        return;
      case 'pong':
        for (const l of this.pongListeners) l(msg);
        return;
      case 'release':
        this.onRelease(msg);
        return;
      case 'takeover':
        this.onTakeover(msg);
        return;
    }
  }

  private onClaim(msg: LockMessage): void {
    if (this.entries.get(msg.key)?.state() === 'owned') {
      this.channel.post({ type: 'pong', key: msg.key, tabId: this.tabId });
    }
  }

  private onRelease(msg: LockMessage): void {
    const entry = this.entries.get(msg.key);
    if (entry && entry.ownerTabId === msg.tabId) {
      entry.state.set('idle');
      entry.ownerTabId = null;
    }
  }

  private onTakeover(msg: LockMessage): void {
    if (msg.toTabId !== this.tabId) return;
    const entry = this.entries.get(msg.key);
    if (entry?.state() === 'owned') {
      entry.state.set('evicted');
      entry.ownerTabId = msg.tabId;
    }
  }

  private releaseAll(): void {
    for (const [key, entry] of this.entries) {
      if (entry.state() === 'owned') {
        this.channel.post({ type: 'release', key, tabId: this.tabId });
      }
    }
  }

  private entry(key: string): Entry {
    let e = this.entries.get(key);
    if (!e) {
      e = { state: signal<LockState>('idle'), ownerTabId: null };
      this.entries.set(key, e);
    }
    return e;
  }

  private keyOf(kind: string, id: string): string {
    return `${kind}:${id}`;
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
