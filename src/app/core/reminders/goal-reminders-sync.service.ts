import { Injectable, effect, inject } from '@angular/core';

import { WorkspaceService } from '@core/fs/workspace.service';
import { GoalsService } from '@features/goals/services/goals.service';
import type { GoalSummary } from '@features/goals/models/goal.types';
import type { ReminderSummary } from '@features/reminders/models/reminder.types';
import { RemindersService } from '@features/reminders/services/reminders.service';

interface SyncDiff {
  readonly toCreate: readonly GoalSummary[];
  readonly toDelete: readonly string[];
  readonly toRetitle: readonly ReminderSummary[];
  readonly toReschedule: readonly { id: string; target: string }[];
}

// why: end-of-day timestamp for a goal's date-only deadline. The
//      reminder lives in user-facing wall-clock, so we encode the
//      "you have until the end of that day" semantics by setting the
//      target to 23:59 local.
const deadlineTarget = (deadline: string): string => `${deadline}T23:59`;

// why: §14 — owns the goal→reminder lifecycle: one Reminder per enabled
//      goal-with-deadline, with title + target kept in sync. The actual
//      ping cadence (when within the lead-up series this fires) lives in
//      RemindersCadenceService — this service only manages existence,
//      title, and the user-facing `dueAt` target. Idempotent: each tick
//      acts only on real diffs, so cascading signal updates settle in
//      O(1) rounds.
@Injectable({ providedIn: 'root' })
export class GoalRemindersSyncService {
  private readonly workspace = inject(WorkspaceService);
  private readonly goals = inject(GoalsService);
  private readonly reminders = inject(RemindersService);

  private pending: Promise<void> = Promise.resolve();

  constructor() {
    effect(() => {
      this.goals.summaries();
      this.reminders.summaries();
      if (this.workspace.root() === null) return;
      this.schedule(() => this.sync());
    });
  }

  async disableForGoal(goalId: string): Promise<void> {
    const current = await this.goals.read(goalId);
    if (!current.reminder.enabled) return;
    await this.goals.save({ ...current, reminder: { enabled: false } });
  }

  private schedule(run: () => Promise<void>): Promise<void> {
    const next = this.pending.then(run).catch((e) => {
      console.warn('[goal-reminders-sync] task failed', e);
    });
    this.pending = next;
    return next;
  }

  private async sync(): Promise<void> {
    for (let guard = 0; guard < 200; guard++) {
      const diff = this.computeDiff();
      const op = pickFirstOp(diff);
      if (!op) return;
      try {
        await this.applyOp(op);
      } catch (e) {
        console.warn('[goal-reminders-sync] op failed', op, e);
        return;
      }
    }
  }

  private computeDiff(): SyncDiff {
    const goalSummaries = this.goals.summaries();
    const reminderSummaries = this.reminders.summaries();

    const goalSourced = reminderSummaries.filter((r) => r.sourceKind === 'goal');
    const byGoalId = new Map<string, ReminderSummary>();
    const duplicates: string[] = [];
    for (const r of goalSourced) {
      if (r.sourceId === null) {
        duplicates.push(r.id);
        continue;
      }
      const existing = byGoalId.get(r.sourceId);
      // why: keep the lex-smallest id so the choice is stable across ticks.
      if (!existing) {
        byGoalId.set(r.sourceId, r);
      } else if (r.id < existing.id) {
        duplicates.push(existing.id);
        byGoalId.set(r.sourceId, r);
      } else {
        duplicates.push(r.id);
      }
    }

    const goalsById = new Map(goalSummaries.map((g) => [g.id, g] as const));
    const toCreate: GoalSummary[] = [];
    const toDelete: string[] = [...duplicates];
    const toRetitle: ReminderSummary[] = [];
    const toReschedule: { id: string; target: string }[] = [];

    for (const goal of goalSummaries) {
      const needsReminder = goal.reminder.enabled && goal.deadline !== null && !goal.completed;
      const existing = byGoalId.get(goal.id);
      if (needsReminder && !existing) toCreate.push(goal);
      else if (!needsReminder && existing) toDelete.push(existing.id);
      else if (needsReminder && existing && goal.deadline !== null) {
        if (goal.title && existing.title !== goal.title) toRetitle.push(existing);
        const expected = deadlineTarget(goal.deadline);
        if (existing.dueAt !== expected) {
          toReschedule.push({ id: existing.id, target: expected });
        }
      }
    }
    for (const r of goalSourced) {
      if (r.sourceId !== null && !goalsById.has(r.sourceId) && !toDelete.includes(r.id)) {
        toDelete.push(r.id);
      }
    }
    return { toCreate, toDelete, toRetitle, toReschedule };
  }

  private async applyOp(op: SyncOp): Promise<void> {
    if (op.kind === 'delete') {
      await this.reminders.deleteToTrash(op.id);
      return;
    }
    if (op.kind === 'create') {
      const goal = op.goal;
      if (goal.deadline === null) return;
      const target = deadlineTarget(goal.deadline);
      await this.reminders.create(goal.title, target, { kind: 'goal', id: goal.id });
      return;
    }
    if (op.kind === 'retitle') {
      const goal = this.goals.summaries().find((g) => g.id === op.sourceId);
      if (!goal) return;
      const current = await this.reminders.read(op.id);
      await this.reminders.save({ ...current, title: goal.title });
      return;
    }
    if (op.kind === 'reschedule') {
      const current = await this.reminders.read(op.id);
      // why: only touch `dueAt` (the user-facing target) + re-open if the
      //      previous cycle exhausted. `nextPingAt` is owned by the cadence
      //      service — touching it here would race its writes on the same
      //      file. Cadence will recompute the next slot on the next tick.
      await this.reminders.save({ ...current, dueAt: op.target, done: false });
      return;
    }
  }
}

type SyncOp =
  | { kind: 'delete'; id: string }
  | { kind: 'create'; goal: GoalSummary }
  | { kind: 'retitle'; id: string; sourceId: string }
  | { kind: 'reschedule'; id: string; target: string };

const pickFirstOp = (diff: SyncDiff): SyncOp | null => {
  const del = diff.toDelete[0];
  if (del !== undefined) return { kind: 'delete', id: del };
  const cre = diff.toCreate[0];
  if (cre !== undefined) return { kind: 'create', goal: cre };
  const ret = diff.toRetitle[0];
  if (ret !== undefined && ret.sourceId !== null) {
    return { kind: 'retitle', id: ret.id, sourceId: ret.sourceId };
  }
  const res = diff.toReschedule[0];
  if (res !== undefined) return { kind: 'reschedule', id: res.id, target: res.target };
  return null;
};
