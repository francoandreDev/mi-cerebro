import { Injectable, effect, inject } from '@angular/core';

import { WorkspaceService } from '@core/fs/workspace.service';
import { SettingsService } from '@core/settings/settings.service';
import { RemindersService } from '@features/reminders/services/reminders.service';

import { nextSlotFor } from './goal-cadence.utils';

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

  // why: serialize FS writes so cascading signal updates don't race.
  private pending: Promise<void> = Promise.resolve();

  constructor() {
    effect(() => {
      this.reminders.summaries();
      this.settings.state();
      if (this.workspace.root() === null) return;
      this.schedule(() => this.sync());
    });
  }

  // why: called by the scheduler right after firing — recompute the next
  //      ping (advancing past `now`) and persist. Series exhausted ⇒
  //      mark done so the reminder shows up in history but stops firing.
  async advance(reminderId: string): Promise<void> {
    if (this.workspace.root() === null) return;
    await this.schedule(async () => {
      const summary = this.reminders.summaries().find((r) => r.id === reminderId);
      if (!summary || summary.done) return;
      const lead = this.settings.state().reminders.leadMinutes;
      const slot = nextSlotFor(summary.dueAt, Date.now(), lead);
      const current = await this.reminders.read(reminderId);
      if (slot === null) {
        await this.reminders.save({ ...current, done: true });
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
        console.warn('[reminders-cadence] op failed', op, e);
        return;
      }
    }
  }

  private pickFirstOp(): RescheduleOp | null {
    const lead = this.settings.state().reminders.leadMinutes;
    const now = Date.now();
    for (const r of this.reminders.summaries()) {
      if (r.done) continue;
      const expected = nextSlotFor(r.dueAt, now, lead);
      if (expected === null) {
        // why: target has passed and the overdue tail is exhausted;
        //      mark done so it doesn't keep showing as "pending".
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
    await this.reminders.save({ ...current, nextPingAt: op.slot });
  }
}

type RescheduleOp =
  | { kind: 'reschedule'; id: string; slot: string }
  | { kind: 'finish'; id: string };
