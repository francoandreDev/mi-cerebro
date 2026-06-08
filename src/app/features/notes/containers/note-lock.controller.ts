import { computed, effect, inject, signal, type Signal } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { ErrorService } from '@core/errors/error.service';
import { LockService } from '@core/locks/lock.service';

interface HasId {
  readonly id: string;
}

// why: keeps NotesContainer focused on note CRUD. Owns the per-note lock
//      acquire/release lifecycle, eviction reporting, and the foreign-banner
//      acknowledgement state. Must be instantiated inside an injection
//      context (component constructor) so `inject()` and `effect()` work.
export class NoteLockController {
  private readonly locks = inject(LockService);
  private readonly errors = inject(ErrorService);
  private readonly foreignAck = signal(false);
  // why: track which note id we already toasted for; clear on transition out
  //      so a future eviction of the same id can re-fire.
  private lastEvictedKey: string | null = null;

  readonly state: Signal<'idle' | 'owned' | 'foreign' | 'evicted'>;
  readonly editable: Signal<boolean>;
  readonly showForeign: Signal<boolean>;
  readonly showEvicted: Signal<boolean>;

  constructor(private readonly active: Signal<HasId | null>) {
    this.state = computed(() => {
      const note = active();
      if (!note) return 'idle' as const;
      return this.locks.state('note', note.id)();
    });
    this.editable = computed(() => this.state() === 'owned');
    this.showForeign = computed(() => this.state() === 'foreign' && !this.foreignAck());
    this.showEvicted = computed(() => this.state() === 'evicted');

    // why: acquire on entering a note, release on leaving / swapping.
    effect((onCleanup) => {
      const note = active();
      if (!note) return;
      this.foreignAck.set(false);
      void this.locks.acquire('note', note.id);
      const key = note.id;
      onCleanup(() => this.locks.release('note', key));
    });

    // why: surface eviction with a one-shot AUT-006 toast.
    effect(() => {
      const note = active();
      if (!note) return;
      const state = this.locks.state('note', note.id)();
      const key = note.id;
      if (state === 'evicted' && this.lastEvictedKey !== key) {
        this.lastEvictedKey = key;
        this.errors.report(new AppError(ERROR_CODES.AUT_006, { severity: 'warning' }));
      } else if (state !== 'evicted' && this.lastEvictedKey === key) {
        this.lastEvictedKey = null;
      }
    });
  }

  acceptReadonly(): void {
    this.foreignAck.set(true);
  }

  takeover(): void {
    const note = this.active();
    if (!note) return;
    this.locks.takeover('note', note.id);
    this.foreignAck.set(false);
  }

  dismissEvicted(): void {
    const note = this.active();
    if (!note) return;
    this.locks.clearEviction('note', note.id);
  }

  // why: UI is disabled in readonly mode, but a forced write (programmatic,
  //      stale callback) must still raise AUT-005 instead of silently writing.
  guardWrite(): boolean {
    if (this.editable()) return true;
    this.errors.report(new AppError(ERROR_CODES.AUT_005, { severity: 'warning' }));
    return false;
  }
}
