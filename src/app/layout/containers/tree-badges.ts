import type { I18nService } from '@core/i18n/i18n.service';
import type { Tag } from '@core/tags/tag.types';
import type { TreeNodeBadge } from '@shared/tree/tree.types';
import type { GoalSummary } from '@features/goals/models/goal.types';
import type { TaskSummary } from '@features/tasks/models/task.types';

export const todayIso = (): string => new Date().toISOString().slice(0, 10);

export const relativeDate = (iso: string, i18n: I18nService): string => {
  if (iso === todayIso()) return i18n.t('tasks.due.today');
  const t = new Date();
  t.setDate(t.getDate() + 1);
  if (iso === t.toISOString().slice(0, 10)) return i18n.t('tasks.due.tomorrow');
  return iso.slice(5);
};

export const tagBadges = (
  ids: readonly string[],
  lookup: ReadonlyMap<string, Tag>,
): readonly TreeNodeBadge[] => {
  const out: TreeNodeBadge[] = [];
  for (const id of ids) {
    const tag = lookup.get(id);
    if (tag) out.push({ id: tag.id, label: tag.label, color: tag.color });
  }
  return out;
};

export const taskBadges = (
  task: TaskSummary,
  lookup: ReadonlyMap<string, Tag>,
  i18n: I18nService,
): readonly TreeNodeBadge[] => {
  const out: TreeNodeBadge[] = [];
  if (task.done) out.push({ id: '__done', label: '✓', color: 'var(--mc-fg-muted)' });
  const next = task.dueDates[0];
  if (!task.done && next !== undefined) {
    const color = next < todayIso() ? 'var(--mc-fg-warning, #d97706)' : 'var(--mc-accent-primary)';
    out.push({ id: `__due:${next}`, label: relativeDate(next, i18n), color });
  }
  for (const tag of tagBadges(task.tags, lookup)) out.push(tag);
  return out;
};

export const goalBadges = (
  goal: GoalSummary,
  lookup: ReadonlyMap<string, Tag>,
  i18n: I18nService,
): readonly TreeNodeBadge[] => {
  const out: TreeNodeBadge[] = [];
  if (goal.completed) out.push({ id: '__done', label: '✓', color: 'var(--mc-fg-muted)' });
  const due = goal.deadline;
  if (!goal.completed && due !== null) {
    const color = due < todayIso() ? 'var(--mc-fg-warning, #d97706)' : 'var(--mc-accent-primary)';
    out.push({ id: `__deadline:${due}`, label: relativeDate(due, i18n), color });
  }
  for (const tag of tagBadges(goal.tags, lookup)) out.push(tag);
  return out;
};
