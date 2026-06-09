import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';

import { RemindersService } from '@features/reminders/services/reminders.service';
import type { ReminderSummary } from '@features/reminders/models/reminder.types';

// why: in-app only (§14) — fires a toast when a reminder's local time
//      passes while the app is open. Schedules a single setTimeout for
//      the soonest pending due, re-arming whenever summaries change.
@Injectable({ providedIn: 'root' })
export class ReminderSchedulerService {
  private readonly reminders = inject(RemindersService);
  private readonly destroyRef = inject(DestroyRef);

  private timer: ReturnType<typeof setTimeout> | null = null;
  private firedIds = new Set<string>();

  private readonly toastSignal = signal<ReminderSummary | null>(null);
  readonly active = this.toastSignal.asReadonly();

  private readonly nextDue = computed<ReminderSummary | null>(() => {
    const now = Date.now();
    let best: ReminderSummary | null = null;
    for (const r of this.reminders.summaries()) {
      if (r.done) continue;
      if (this.firedIds.has(r.id)) continue;
      const t = parseLocal(r.dueAt);
      if (t === null) continue;
      if (t < now) {
        // already overdue, fire immediately on next tick
        return r;
      }
      if (!best || t < (parseLocal(best.dueAt) ?? Number.POSITIVE_INFINITY)) best = r;
    }
    return best;
  });

  constructor() {
    effect(() => {
      const next = this.nextDue();
      this.clearTimer();
      if (!next) return;
      const due = parseLocal(next.dueAt) ?? Date.now();
      const delay = Math.max(0, due - Date.now());
      this.timer = setTimeout(() => this.fire(next), Math.min(delay, 2_147_483_000));
    });
    this.destroyRef.onDestroy(() => this.clearTimer());
  }

  dismiss(): void {
    this.toastSignal.set(null);
  }

  private fire(reminder: ReminderSummary): void {
    this.firedIds.add(reminder.id);
    this.toastSignal.set(reminder);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

// why: dueAt is wall-clock without timezone (e.g. "2026-06-15T09:30");
//      parse it as local time so the user's calendar matches what fires.
const parseLocal = (raw: string): number | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(raw);
  if (!m) {
    const t = Date.parse(raw);
    return Number.isNaN(t) ? null : t;
  }
  const [, y, mo, d, h, mi, s] = m as unknown as string[];
  return new Date(+y!, +mo! - 1, +d!, +h!, +mi!, +(s ?? '0')).getTime();
};
