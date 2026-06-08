import { Injectable } from '@angular/core';

import type { LockMessage } from './lock.types';

const CHANNEL_NAME = 'mc-locks';

// Why: a thin wrapper around BroadcastChannel so LockService can be tested
//      with a fake bus that connects N "tabs" inside the same JS context.
@Injectable({ providedIn: 'root' })
export class LockChannel {
  private readonly bc: BroadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  private readonly listeners = new Set<(msg: LockMessage) => void>();

  constructor() {
    this.bc.onmessage = (event: MessageEvent<LockMessage>) => {
      for (const l of this.listeners) l(event.data);
    };
  }

  post(msg: LockMessage): void {
    this.bc.postMessage(msg);
  }

  onMessage(listener: (msg: LockMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
