import type { ReminderSummary } from '../models/reminder.types';

export type BucketKey =
  | 'overdue'
  | 'today'
  | 'tomorrow'
  | 'thisWeek'
  | 'later'
  | 'undated'
  | 'done';

export const PENDING_BUCKETS: readonly BucketKey[] = [
  'overdue',
  'today',
  'tomorrow',
  'thisWeek',
  'later',
  'undated',
];

const startOfDay = (d: Date): Date => {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
};

const parseLocal = (iso: string): Date | null => {
  if (!iso) return null;
  // why: dueAt is wall-clock local-time (no Z). new Date(string) parses
  //      "YYYY-MM-DDTHH:mm" as local; bail if input is malformed.
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const bucketOf = (r: ReminderSummary, now: Date = new Date()): BucketKey => {
  if (r.done) return 'done';
  const d = parseLocal(r.dueAt);
  if (!d) return 'undated';
  const today = startOfDay(now);
  const dueDay = startOfDay(d);
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000);
  if (d.getTime() < now.getTime()) return 'overdue';
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays <= 7) return 'thisWeek';
  return 'later';
};

export const groupByBucket = (
  reminders: readonly ReminderSummary[],
  now: Date = new Date(),
): ReadonlyMap<BucketKey, readonly ReminderSummary[]> => {
  const map = new Map<BucketKey, ReminderSummary[]>();
  for (const r of reminders) {
    const k = bucketOf(r, now);
    const arr = map.get(k);
    if (arr) arr.push(r);
    else map.set(k, [r]);
  }
  return map;
};
