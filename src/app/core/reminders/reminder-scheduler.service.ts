import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';

import { RemindersService } from '@features/reminders/services/reminders.service';
import type { ReminderSummary } from '@features/reminders/models/reminder.types';

import { RemindersCadenceService } from './reminders-cadence.service';

// why: in-app only (§14) — fires a toast when a reminder's `nextPingAt`
//      passes while the app is open. Schedules a single setTimeout for
//      the soonest pending, re-arming whenever summaries change. On fire,
//      defers to RemindersCadenceService which persists the next slot of
//      the lead-up series (or marks the reminder done if exhausted).
@Injectable({ providedIn: 'root' })
export class ReminderSchedulerService {
  private readonly reminders = inject(RemindersService);
  private readonly cadence = inject(RemindersCadenceService);
  private readonly destroyRef = inject(DestroyRef);

  private timer: ReturnType<typeof setTimeout> | null = null;
  // why: track which `nextPingAt` we last fired for each reminder. The
  //      cadence service advances `nextPingAt` to the next slot in the
  //      series after each fire — when that happens, the new value won't
  //      match what's in this map and the reminder becomes eligible to
  //      fire again. A plain Set<id> would mute every subsequent ping
  //      until reload.
  private firedAt = new Map<string, string>();

  private readonly toastSignal = signal<ReminderSummary | null>(null);
  readonly active = this.toastSignal.asReadonly();

  private readonly nextDue = computed<ReminderSummary | null>(() => {
    const now = Date.now();
    let best: ReminderSummary | null = null;
    for (const r of this.reminders.summaries()) {
      if (r.done) continue;
      // why: pausing should silence both future fires and any catch-up
      //      ping that would normally trigger as soon as `nextPingAt`
      //      passes. Resuming makes them eligible again on the next tick.
      if (r.paused) continue;
      if (this.firedAt.get(r.id) === r.nextPingAt) continue;
      const t = parseLocal(r.nextPingAt);
      if (t === null) continue;
      if (t < now) {
        // already overdue, fire immediately on next tick
        return r;
      }
      if (!best || t < (parseLocal(best.nextPingAt) ?? Number.POSITIVE_INFINITY)) best = r;
    }
    return best;
  });

  constructor() {
    effect(() => {
      const next = this.nextDue();
      this.clearTimer();
      if (!next) return;
      const due = parseLocal(next.nextPingAt) ?? Date.now();
      const delay = Math.max(0, due - Date.now());
      this.timer = setTimeout(() => this.fire(next), Math.min(delay, 2_147_483_000));
    });
    this.destroyRef.onDestroy(() => this.clearTimer());
  }

  dismiss(): void {
    this.toastSignal.set(null);
  }

  // why: "posponer" en el toast de un reminder goal-sourced — salta el
  //      próximo slot de la serie sin desactivar el toggle ni tocar el
  //      deadline. Ver RemindersCadenceService.skipNextSlot.
  snoozeGoalReminder(reminder: ReminderSummary): void {
    void this.cadence.skipNextSlot(reminder.id);
    this.dismiss();
  }

  private fire(reminder: ReminderSummary): void {
    this.firedAt.set(reminder.id, reminder.nextPingAt);
    this.toastSignal.set(reminder);
    // why: every reminder (manual or goal-sourced) advances through the
    //      same lead-up series — the cadence service persists the next
    //      slot, or marks the reminder done if the series is exhausted.
    void this.cadence.advance(reminder.id);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

// why: nextPingAt is wall-clock without timezone (e.g. "2026-06-15T09:30");
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
