// Cross-feature mutex over the user's FS Access workspace. Held by
// autocommit while running git operations and by autosave's onFlush
// callbacks while writing entity files. Sequencing both behind this
// lock prevents the InvalidStateError race we observed when two
// fast writers touch the same directory handle in parallel.

import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class FsLockService {
  private busy = false;
  private readonly waiters: (() => void)[] = [];

  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  isBusy(): boolean {
    return this.busy;
  }

  private acquire(): Promise<void> {
    if (!this.busy) {
      this.busy = true;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => this.waiters.push(resolve));
  }

  private release(): void {
    const next = this.waiters.shift();
    if (next) {
      // why: busy stays true; we hand the lock straight to the next
      //      waiter rather than going through an idle state, otherwise
      //      a fresh acquire() could cut the queue.
      next();
      return;
    }
    this.busy = false;
  }
}
