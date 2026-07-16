import { Injectable, effect, inject } from '@angular/core';

import { SettingsService } from '@core/settings/settings.service';
import { WorkspaceService } from '@core/fs/workspace.service';
import { GoalsService } from '@features/goals/services/goals.service';
import { isGoalDormant, type GoalSummary } from '@features/goals/models/goal.types';
import type { ReminderSummary } from '@features/reminders/models/reminder.types';
import { RemindersService } from '@features/reminders/services/reminders.service';

interface SyncDiff {
  readonly toCreate: readonly GoalSummary[];
  readonly toDelete: readonly string[];
}

// why: §14 + docs/evolution.md idea 3 — owns the goal-dormancy→reminder
//      lifecycle. Unlike GoalRemindersSyncService (one persistent reminder
//      per goal-with-deadline), this one fires a single point-in-time
//      reminder the moment a goal crosses into dormancy, and removes it if
//      the goal resumes progress. "Existing reminder present?" doubles as
//      the transition-edge check: no manual prev-state tracking needed —
//      once created it stays until dormancy clears, so it can't re-fire
//      while the goal remains dormant.
@Injectable({ providedIn: 'root' })
export class GoalDormantRemindersSyncService {
  private readonly workspace = inject(WorkspaceService);
  private readonly goals = inject(GoalsService);
  private readonly reminders = inject(RemindersService);
  private readonly settings = inject(SettingsService);

  private pending: Promise<void> = Promise.resolve();

  constructor() {
    effect(() => {
      this.goals.summaries();
      this.reminders.summaries();
      void this.settings.state().goals.dormantThresholdDays;
      if (this.workspace.root() === null) return;
      this.schedule(() => this.sync());
    });
  }

  async disableForGoal(goalId: string): Promise<void> {
    const current = await this.goals.read(goalId);
    if (!current.reminder.notifyOnDormant) return;
    await this.goals.save({
      ...current,
      reminder: { ...current.reminder, notifyOnDormant: false },
    });
  }

  private schedule(run: () => Promise<void>): Promise<void> {
    const next = this.pending.then(run).catch((e) => {
      console.warn('[goal-dormant-reminders-sync] task failed', e);
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
        console.warn('[goal-dormant-reminders-sync] op failed', op, e);
        return;
      }
    }
  }

  private computeDiff(): SyncDiff {
    const goalSummaries = this.goals.summaries();
    const reminderSummaries = this.reminders.summaries();
    const thresholdDays = this.settings.state().goals.dormantThresholdDays;
    const now = Date.now();

    const dormantSourced = reminderSummaries.filter((r) => r.sourceKind === 'goal-dormant');
    const byGoalId = new Map<string, ReminderSummary>();
    const duplicates: string[] = [];
    for (const r of dormantSourced) {
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

    for (const goal of goalSummaries) {
      const dormant = isGoalDormant(goal.completed, goal.lastProgressAt, thresholdDays, now);
      const needsReminder = goal.reminder.notifyOnDormant && dormant;
      const existing = byGoalId.get(goal.id);
      if (needsReminder && !existing) toCreate.push(goal);
      else if (!needsReminder && existing) toDelete.push(existing.id);
    }
    for (const r of dormantSourced) {
      if (r.sourceId !== null && !goalsById.has(r.sourceId) && !toDelete.includes(r.id)) {
        toDelete.push(r.id);
      }
    }
    return { toCreate, toDelete };
  }

  private async applyOp(op: SyncOp): Promise<void> {
    if (op.kind === 'delete') {
      await this.reminders.deleteToTrash(op.id);
      return;
    }
    const goal = op.goal;
    await this.reminders.create(goal.title, new Date().toISOString(), {
      kind: 'goal-dormant',
      id: goal.id,
    });
  }
}

type SyncOp = { kind: 'delete'; id: string } | { kind: 'create'; goal: GoalSummary };

const pickFirstOp = (diff: SyncDiff): SyncOp | null => {
  const del = diff.toDelete[0];
  if (del !== undefined) return { kind: 'delete', id: del };
  const cre = diff.toCreate[0];
  if (cre !== undefined) return { kind: 'create', goal: cre };
  return null;
};
