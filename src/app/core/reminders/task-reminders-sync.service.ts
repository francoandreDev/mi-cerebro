import { Injectable, effect, inject } from '@angular/core';

import { WorkspaceService } from '@core/fs/workspace.service';
import type { TaskSummary } from '@features/tasks/models/task.types';
import { TasksService } from '@features/tasks/services/tasks.service';
import type { ReminderSummary } from '@features/reminders/models/reminder.types';
import { RemindersService } from '@features/reminders/services/reminders.service';

interface SyncDiff {
  readonly toCreate: readonly TaskSummary[];
  readonly toDelete: readonly string[];
  readonly toRetitle: readonly ReminderSummary[];
  readonly toReschedule: readonly { id: string; target: string }[];
}

// why: end-of-day timestamp for a task's date-only due date, same
//      "you have until the end of that day" semantics as goal deadlines.
const dueDateTarget = (dueDate: string): string => `${dueDate}T23:59`;

// why: §14 extension — owns the task→reminder lifecycle, mirroring
//      GoalRemindersSyncService. One Reminder per enabled task with a due
//      date, sourced from `dueDates[0]` (the next-due date per the
//      sortDueDates convention). Idempotent: each tick acts only on real
//      diffs, so cascading signal updates settle in O(1) rounds.
@Injectable({ providedIn: 'root' })
export class TaskRemindersSyncService {
  private readonly workspace = inject(WorkspaceService);
  private readonly tasks = inject(TasksService);
  private readonly reminders = inject(RemindersService);

  private pending: Promise<void> = Promise.resolve();

  constructor() {
    effect(() => {
      this.tasks.summaries();
      this.reminders.summaries();
      if (this.workspace.root() === null) return;
      this.schedule(() => this.sync());
    });
  }

  async disableForTask(taskId: string): Promise<void> {
    const current = await this.tasks.read(taskId);
    if (!current.reminder.enabled) return;
    await this.tasks.save({ ...current, reminder: { ...current.reminder, enabled: false } });
  }

  private schedule(run: () => Promise<void>): Promise<void> {
    const next = this.pending.then(run).catch((e) => {
      console.warn('[task-reminders-sync] task failed', e);
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
        console.warn('[task-reminders-sync] op failed', op, e);
        return;
      }
    }
  }

  private computeDiff(): SyncDiff {
    const taskSummaries = this.tasks.summaries();
    const reminderSummaries = this.reminders.summaries();

    const taskSourced = reminderSummaries.filter((r) => r.sourceKind === 'task');
    const byTaskId = new Map<string, ReminderSummary>();
    const duplicates: string[] = [];
    for (const r of taskSourced) {
      if (r.sourceId === null) {
        duplicates.push(r.id);
        continue;
      }
      const existing = byTaskId.get(r.sourceId);
      // why: keep the lex-smallest id so the choice is stable across ticks.
      if (!existing) {
        byTaskId.set(r.sourceId, r);
      } else if (r.id < existing.id) {
        duplicates.push(existing.id);
        byTaskId.set(r.sourceId, r);
      } else {
        duplicates.push(r.id);
      }
    }

    const tasksById = new Map(taskSummaries.map((t) => [t.id, t] as const));
    const toCreate: TaskSummary[] = [];
    const toDelete: string[] = [...duplicates];
    const toRetitle: ReminderSummary[] = [];
    const toReschedule: { id: string; target: string }[] = [];

    for (const task of taskSummaries) {
      const dueDate = task.dueDates[0];
      const needsReminder = task.reminder.enabled && dueDate !== undefined && !task.done;
      const existing = byTaskId.get(task.id);
      if (needsReminder && !existing) toCreate.push(task);
      else if (!needsReminder && existing) toDelete.push(existing.id);
      else if (needsReminder && existing && dueDate !== undefined) {
        if (task.title && existing.title !== task.title) toRetitle.push(existing);
        const expected = dueDateTarget(dueDate);
        if (existing.dueAt !== expected) {
          toReschedule.push({ id: existing.id, target: expected });
        }
      }
    }
    for (const r of taskSourced) {
      if (r.sourceId !== null && !tasksById.has(r.sourceId) && !toDelete.includes(r.id)) {
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
      const task = op.task;
      const dueDate = task.dueDates[0];
      if (dueDate === undefined) return;
      const target = dueDateTarget(dueDate);
      await this.reminders.create(task.title, target, { kind: 'task', id: task.id });
      return;
    }
    if (op.kind === 'retitle') {
      const task = this.tasks.summaries().find((t) => t.id === op.sourceId);
      if (!task) return;
      const current = await this.reminders.read(op.id);
      await this.reminders.save({ ...current, title: task.title });
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
  | { kind: 'create'; task: TaskSummary }
  | { kind: 'retitle'; id: string; sourceId: string }
  | { kind: 'reschedule'; id: string; target: string };

const pickFirstOp = (diff: SyncDiff): SyncOp | null => {
  const del = diff.toDelete[0];
  if (del !== undefined) return { kind: 'delete', id: del };
  const cre = diff.toCreate[0];
  if (cre !== undefined) return { kind: 'create', task: cre };
  const ret = diff.toRetitle[0];
  if (ret !== undefined && ret.sourceId !== null) {
    return { kind: 'retitle', id: ret.id, sourceId: ret.sourceId };
  }
  const res = diff.toReschedule[0];
  if (res !== undefined) return { kind: 'reschedule', id: res.id, target: res.target };
  return null;
};
