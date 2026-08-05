import { Injectable, effect, inject } from '@angular/core';

import { AppError } from '@core/errors/app-error';
import { ERROR_CODES } from '@core/errors/error.codes';
import { WorkspaceService } from '@core/fs/workspace.service';
import { SettingsService } from '@core/settings/settings.service';
import { GoalsService } from '@features/goals/services/goals.service';
import type { Reminder, ReminderSourceKind } from '@features/reminders/models/reminder.types';
import { RemindersService } from '@features/reminders/services/reminders.service';
import { nextDueAfter } from '@features/reminders/utils/recurrence';

import { nextSlotFor, parseTarget, resolveLeadMinutes } from './goal-cadence.utils';

// why: §14 — owns the ping cadence for EVERY reminder (manual or goal-
//      sourced). `dueAt` is the user's target; this service maintains
//      `nextPingAt` as the next lead-up slot. When the series exhausts,
//      the reminder is marked done so it stops nagging without losing
//      history. The goal-sync service is now purely a goal→reminder
//      lifecycle layer (create/delete/title); timing lives here.
@Injectable({ providedIn: 'root' })
export class RemindersCadenceService {
  private readonly workspace = inject(WorkspaceService);
  private readonly settings = inject(SettingsService);
  private readonly reminders = inject(RemindersService);
  private readonly goals = inject(GoalsService);

  // why: serialize FS writes so cascading signal updates don't race.
  private pending: Promise<void> = Promise.resolve();

  constructor() {
    effect(() => {
      this.reminders.summaries();
      this.settings.state();
      // why: a goal's `reminderLeadMinutes` override changes the cadence for
      //      its reminder without necessarily touching reminders.summaries()
      //      — read it here so editing the override re-syncs immediately.
      this.goals.summaries();
      if (this.workspace.root() === null) return;
      this.schedule(() => this.sync());
    });
  }

  // why: docs/deferred/reminders-goals.md "Lead-time por meta" — a goal
  //      reminder uses its source goal's `reminderLeadMinutes` when set,
  //      else the global `settings.reminders.leadMinutes` (unchanged
  //      behavior for every non-goal reminder and every goal without an
  //      override).
  private leadMinutesFor(sourceKind: ReminderSourceKind | null, sourceId: string | null): number {
    const globalLead = this.settings.state().reminders.leadMinutes;
    const goal =
      sourceId === null ? undefined : this.goals.summaries().find((g) => g.id === sourceId);
    return resolveLeadMinutes(sourceKind, goal?.reminderLeadMinutes, globalLead);
  }

  // why: called by the scheduler right after firing — recompute the next
  //      ping (advancing past `now`) and persist. Series exhausted ⇒
  //      mark done so the reminder shows up in history but stops firing.
  async advance(reminderId: string): Promise<void> {
    return this.rescheduleFrom(reminderId, Date.now());
  }

  // why: "posponer" para reminders goal-sourced — a diferencia de los
  //      manuales, su `dueAt` refleja el deadline de la meta y lo pisa
  //      GoalRemindersSyncService en cuanto se desvía, así que no se puede
  //      empujar como snooze. En cambio saltamos el próximo slot de la
  //      serie: misma matemática que un fire normal, pero calculada desde
  //      el slot que está por sonar en vez de desde "ahora".
  async skipNextSlot(reminderId: string): Promise<void> {
    const summary = this.reminders.summaries().find((r) => r.id === reminderId);
    if (!summary) return;
    const fromMs = parseTarget(summary.nextPingAt) ?? Date.now();
    return this.rescheduleFrom(reminderId, fromMs);
  }

  private async rescheduleFrom(reminderId: string, fromMs: number): Promise<void> {
    if (this.workspace.root() === null) return;
    await this.schedule(async () => {
      const summary = this.reminders.summaries().find((r) => r.id === reminderId);
      if (!summary || summary.done) return;
      const lead = this.leadMinutesFor(summary.sourceKind, summary.sourceId);
      const slot = nextSlotFor(summary.dueAt, fromMs, lead);
      const current = await this.reminders.read(reminderId);
      if (slot === null) {
        // why: lead-up series exhausted. Recurring reminders roll their
        //      dueAt forward to the next occurrence instead of being
        //      marked done — the cadence sync loop will then re-seed
        //      nextPingAt for the new target on the next tick.
        const rolled = rollover(current, Date.now());
        await this.reminders.save(rolled);
        return;
      }
      if (current.nextPingAt === slot) return;
      await this.reminders.save({ ...current, nextPingAt: slot });
    });
  }

  private schedule(run: () => Promise<void>): Promise<void> {
    const next = this.pending.then(run).catch((e) => {
      console.warn('[reminders-cadence] task failed', e);
    });
    this.pending = next;
    return next;
  }

  // why: loop one-op-at-a-time recomputing diffs against live signals,
  //      same pattern as GoalRemindersSyncService — avoids stale-snapshot
  //      cascades when multiple reminders need rescheduling at once.
  private async sync(): Promise<void> {
    for (let guard = 0; guard < 500; guard++) {
      const op = this.pickFirstOp();
      if (!op) return;
      try {
        await this.applyOp(op);
      } catch (e) {
        if (isStaleFilename(e)) {
          // why: the summary signal pointed at a reminder whose filename
          //      map was cleared by a concurrent refresh (or whose file
          //      vanished). Resync once and retry the same op — if the
          //      id is gone from summaries, pickFirstOp won't see it
          //      again on the next iteration.
          await this.reminders.refresh();
          try {
            await this.applyOp(op);
          } catch (retry) {
            if (!isStaleFilename(retry)) {
              console.warn('[reminders-cadence] op failed', op, retry);
              return;
            }
            // still stale → the id is truly gone; move on.
          }
          continue;
        }
        console.warn('[reminders-cadence] op failed', op, e);
        return;
      }
    }
  }

  private pickFirstOp(): RescheduleOp | null {
    const now = Date.now();
    for (const r of this.reminders.summaries()) {
      if (r.done) continue;
      // why: paused reminders stay where they are — neither rescheduled
      //      nor marked done — so resuming picks back up cleanly.
      if (r.paused) continue;
      const lead = this.leadMinutesFor(r.sourceKind, r.sourceId);
      const expected = nextSlotFor(r.dueAt, now, lead);
      if (expected === null) {
        // why: target has passed and the lead-up tail is exhausted.
        //      Recurring reminders roll dueAt forward; one-shots get
        //      marked done so they stop showing as pending.
        if (r.recurrence) return { kind: 'rollover', id: r.id };
        return { kind: 'finish', id: r.id };
      }
      if (expected !== r.nextPingAt) {
        return { kind: 'reschedule', id: r.id, slot: expected };
      }
    }
    return null;
  }

  private async applyOp(op: RescheduleOp): Promise<void> {
    const current = await this.reminders.read(op.id);
    if (op.kind === 'finish') {
      await this.reminders.save({ ...current, done: true });
      return;
    }
    if (op.kind === 'rollover') {
      await this.reminders.save(rollover(current, Date.now()));
      return;
    }
    await this.reminders.save({ ...current, nextPingAt: op.slot });
  }
}

type RescheduleOp =
  | { kind: 'reschedule'; id: string; slot: string }
  | { kind: 'finish'; id: string }
  | { kind: 'rollover'; id: string };

// why: shared between the periodic sync and the post-fire `advance` path
//      so a recurring reminder always rolls forward consistently. If the
//      recurrence rule can't yield a future dueAt (degenerate every=0 or
//      unparseable dueAt), fall back to marking done — better than
//      looping the reminder forever on the same instant.
const rollover = (current: Reminder, nowMs: number): Reminder => {
  const rec = current.recurrence;
  const next = rec ? nextDueAfter(current.dueAt, rec, nowMs) : null;
  if (next === null) return { ...current, done: true };
  return {
    ...current,
    dueAt: next,
    nextPingAt: next,
    recurrence: rec ? { ...rec, cyclesCompleted: (rec.cyclesCompleted ?? 0) + 1 } : rec,
  };
};

const isStaleFilename = (e: unknown): boolean =>
  e instanceof AppError && e.code === ERROR_CODES.FS_003;
