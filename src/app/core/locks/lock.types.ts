// Types shared by LockService and LockChannel.

export type LockState = 'idle' | 'owned' | 'foreign' | 'evicted';

export interface LockMessage {
  readonly type: 'claim' | 'pong' | 'release' | 'takeover';
  readonly key: string;
  readonly tabId: string;
  // present on 'takeover' to address a specific victim.
  readonly toTabId?: string;
}

export type LockOutcome =
  | { readonly granted: true }
  | { readonly granted: false; readonly ownerTabId: string };

export const LOCK_PONG_WAIT_MS = 150;
