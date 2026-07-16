import { Injectable, effect, inject } from '@angular/core';

import { WorkspaceService } from '@core/fs/workspace.service';
import type { WritingSummary } from '@features/writings/models/writing.types';
import { WritingsService } from '@features/writings/services/writings.service';
import type { ReminderSummary } from '@features/reminders/models/reminder.types';
import { RemindersService } from '@features/reminders/services/reminders.service';

interface SyncDiff {
  readonly toCreate: readonly WritingSummary[];
  readonly toDelete: readonly string[];
  readonly toRetitle: readonly ReminderSummary[];
  readonly toReschedule: readonly { id: string; target: string }[];
}

// why: end-of-day timestamp for a writing's date-only deadline, same
//      "you have until the end of that day" semantics as goal deadlines.
const deadlineTarget = (deadline: string): string => `${deadline}T23:59`;

// why: §14 extension — owns the writing→reminder lifecycle, mirroring
//      GoalRemindersSyncService. One Reminder per enabled writing with a
//      deadline. Idempotent: each tick acts only on real diffs, so
//      cascading signal updates settle in O(1) rounds.
@Injectable({ providedIn: 'root' })
export class WritingRemindersSyncService {
  private readonly workspace = inject(WorkspaceService);
  private readonly writings = inject(WritingsService);
  private readonly reminders = inject(RemindersService);

  private pending: Promise<void> = Promise.resolve();

  constructor() {
    effect(() => {
      this.writings.summaries();
      this.reminders.summaries();
      if (this.workspace.root() === null) return;
      this.schedule(() => this.sync());
    });
  }

  async disableForWriting(writingId: string): Promise<void> {
    const current = await this.writings.read(writingId);
    if (!current.reminder.enabled) return;
    await this.writings.save({ ...current, reminder: { ...current.reminder, enabled: false } });
  }

  private schedule(run: () => Promise<void>): Promise<void> {
    const next = this.pending.then(run).catch((e) => {
      console.warn('[writing-reminders-sync] task failed', e);
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
        console.warn('[writing-reminders-sync] op failed', op, e);
        return;
      }
    }
  }

  private computeDiff(): SyncDiff {
    const writingSummaries = this.writings.summaries();
    const reminderSummaries = this.reminders.summaries();

    const writingSourced = reminderSummaries.filter((r) => r.sourceKind === 'writing');
    const byWritingId = new Map<string, ReminderSummary>();
    const duplicates: string[] = [];
    for (const r of writingSourced) {
      if (r.sourceId === null) {
        duplicates.push(r.id);
        continue;
      }
      const existing = byWritingId.get(r.sourceId);
      // why: keep the lex-smallest id so the choice is stable across ticks.
      if (!existing) {
        byWritingId.set(r.sourceId, r);
      } else if (r.id < existing.id) {
        duplicates.push(existing.id);
        byWritingId.set(r.sourceId, r);
      } else {
        duplicates.push(r.id);
      }
    }

    const writingsById = new Map(writingSummaries.map((w) => [w.id, w] as const));
    const toCreate: WritingSummary[] = [];
    const toDelete: string[] = [...duplicates];
    const toRetitle: ReminderSummary[] = [];
    const toReschedule: { id: string; target: string }[] = [];

    for (const writing of writingSummaries) {
      const needsReminder = writing.reminder.enabled && writing.deadline !== null;
      const existing = byWritingId.get(writing.id);
      if (needsReminder && !existing) toCreate.push(writing);
      else if (!needsReminder && existing) toDelete.push(existing.id);
      else if (needsReminder && existing && writing.deadline !== null) {
        if (writing.title && existing.title !== writing.title) toRetitle.push(existing);
        const expected = deadlineTarget(writing.deadline);
        if (existing.dueAt !== expected) {
          toReschedule.push({ id: existing.id, target: expected });
        }
      }
    }
    for (const r of writingSourced) {
      if (r.sourceId !== null && !writingsById.has(r.sourceId) && !toDelete.includes(r.id)) {
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
      const writing = op.writing;
      if (writing.deadline === null) return;
      const target = deadlineTarget(writing.deadline);
      await this.reminders.create(writing.title, target, { kind: 'writing', id: writing.id });
      return;
    }
    if (op.kind === 'retitle') {
      const writing = this.writings.summaries().find((w) => w.id === op.sourceId);
      if (!writing) return;
      const current = await this.reminders.read(op.id);
      await this.reminders.save({ ...current, title: writing.title });
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
  | { kind: 'create'; writing: WritingSummary }
  | { kind: 'retitle'; id: string; sourceId: string }
  | { kind: 'reschedule'; id: string; target: string };

const pickFirstOp = (diff: SyncDiff): SyncOp | null => {
  const del = diff.toDelete[0];
  if (del !== undefined) return { kind: 'delete', id: del };
  const cre = diff.toCreate[0];
  if (cre !== undefined) return { kind: 'create', writing: cre };
  const ret = diff.toRetitle[0];
  if (ret !== undefined && ret.sourceId !== null) {
    return { kind: 'retitle', id: ret.id, sourceId: ret.sourceId };
  }
  const res = diff.toReschedule[0];
  if (res !== undefined) return { kind: 'reschedule', id: res.id, target: res.target };
  return null;
};
