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
  // why: dedupe AUT-005 per id — even if many forced writes hit while in
  //      readonly, the user should see one toast, not a stream.
  private lastForcedWriteKey: string | null = null;

  readonly state: Signal<'idle' | 'owned' | 'foreign' | 'evicted'>;
  readonly editable: Signal<boolean>;
  readonly showForeign: Signal<boolean>;
  readonly showEvicted: Signal<boolean>;

  constructor(private readonly active: Signal<HasId | null>) {
    // why: project to id only so acquire/release doesn't refire on every
    //      keystroke when the active note object is replaced in place.
    const activeId = computed(() => active()?.id ?? null);

    this.state = computed(() => {
      const id = activeId();
      if (id === null) return 'idle' as const;
      return this.locks.state('note', id)();
    });
    this.editable = computed(() => this.state() === 'owned');
    this.showForeign = computed(() => this.state() === 'foreign' && !this.foreignAck());
    this.showEvicted = computed(() => this.state() === 'evicted');

    // why: acquire on entering a note, release on leaving / swapping.
    effect((onCleanup) => {
      const id = activeId();
      if (id === null) return;
      this.foreignAck.set(false);
      this.lastForcedWriteKey = null;
      void this.locks.acquire('note', id);
      onCleanup(() => this.locks.release('note', id));
    });

    // why: surface eviction with a one-shot AUT-006 toast.
    effect(() => {
      const id = activeId();
      if (id === null) return;
      const state = this.locks.state('note', id)();
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
    // why: if the user dismissed the foreign banner ("abrir solo lectura")
    //      and then tries to edit anyway, re-show the banner instead of
    //      silently swallowing the keystroke — they need to know why.
    if (this.state() === 'foreign' && this.foreignAck()) this.foreignAck.set(false);
    const id = this.active()?.id ?? null;
    if (id !== null && this.lastForcedWriteKey !== id) {
      this.lastForcedWriteKey = id;
      this.errors.report(new AppError(ERROR_CODES.AUT_005, { severity: 'warning' }));
    }
    return false;
  }
}
