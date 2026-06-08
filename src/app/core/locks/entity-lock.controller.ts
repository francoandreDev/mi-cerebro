import { computed, effect, inject, signal, type Signal } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { ErrorService } from '@core/errors/error.service';
import { LockService } from '@core/locks/lock.service';

interface HasId {
  readonly id: string;
}

// why: generic per-entity lock orchestrator. Containers instantiate it inside
//      their constructor (needs an injection context for inject() + effect())
//      and bind it to whatever signal exposes the currently-active entity.
//      The signal is projected to its id so acquire/release does not churn on
//      every keystroke (the active object is replaced on each edit).
export class EntityLockController {
  private readonly locks = inject(LockService);
  private readonly errors = inject(ErrorService);
  private readonly foreignAck = signal(false);
  private lastEvictedKey: string | null = null;
  // why: dedupe AUT-005 per id so a stream of forced writes in readonly only
  //      surfaces one toast per session, not one per keystroke.
  private lastForcedWriteKey: string | null = null;

  readonly state: Signal<'idle' | 'owned' | 'foreign' | 'evicted'>;
  readonly editable: Signal<boolean>;
  readonly showForeign: Signal<boolean>;
  readonly showEvicted: Signal<boolean>;

  constructor(
    private readonly kind: string,
    private readonly active: Signal<HasId | null>,
  ) {
    const activeId = computed(() => active()?.id ?? null);

    this.state = computed(() => {
      const id = activeId();
      if (id === null) return 'idle' as const;
      return this.locks.state(this.kind, id)();
    });
    this.editable = computed(() => this.state() === 'owned');
    this.showForeign = computed(() => this.state() === 'foreign' && !this.foreignAck());
    this.showEvicted = computed(() => this.state() === 'evicted');

    effect((onCleanup) => {
      const id = activeId();
      if (id === null) return;
      this.foreignAck.set(false);
      this.lastForcedWriteKey = null;
      void this.locks.acquire(this.kind, id);
      onCleanup(() => this.locks.release(this.kind, id));
    });

    effect(() => {
      const id = activeId();
      if (id === null) return;
      const state = this.locks.state(this.kind, id)();
      if (state === 'evicted' && this.lastEvictedKey !== id) {
        this.lastEvictedKey = id;
        this.errors.report(new AppError(ERROR_CODES.AUT_006, { severity: 'warning' }));
      } else if (state !== 'evicted' && this.lastEvictedKey === id) {
        this.lastEvictedKey = null;
      }
    });
  }

  acceptReadonly(): void {
    this.foreignAck.set(true);
  }

  takeover(): void {
    const entity = this.active();
    if (!entity) return;
    this.locks.takeover(this.kind, entity.id);
    this.foreignAck.set(false);
  }

  dismissEvicted(): void {
    const entity = this.active();
    if (!entity) return;
    this.locks.clearEviction(this.kind, entity.id);
  }

  guardWrite(): boolean {
    if (this.editable()) return true;
    if (this.state() === 'foreign' && this.foreignAck()) this.foreignAck.set(false);
    const id = this.active()?.id ?? null;
    if (id !== null && this.lastForcedWriteKey !== id) {
      this.lastForcedWriteKey = id;
      this.errors.report(new AppError(ERROR_CODES.AUT_005, { severity: 'warning' }));
    }
    return false;
  }
}
