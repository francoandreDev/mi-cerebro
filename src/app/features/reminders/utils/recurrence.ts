import type { Recurrence, RecurrenceUnit } from '../models/reminder.types';

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

const pad = (n: number): string => n.toString().padStart(2, '0');

const toLocalIso = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

const parseLocal = (iso: string): Date | null => {
  const m = ISO_RE.exec(iso);
  if (!m) {
    const t = Date.parse(iso);
    return Number.isNaN(t) ? null : new Date(t);
  }
  const [, y, mo, d, h, mi, s] = m as unknown as string[];
  return new Date(+y!, +mo! - 1, +d!, +h!, +mi!, +(s ?? '0'));
};

const addUnit = (d: Date, every: number, unit: RecurrenceUnit): Date => {
  const next = new Date(d);
  switch (unit) {
    case 'day':
      next.setDate(next.getDate() + every);
      break;
    case 'week':
      next.setDate(next.getDate() + every * 7);
      break;
    case 'month':
      next.setMonth(next.getMonth() + every);
      break;
    case 'year':
      next.setFullYear(next.getFullYear() + every);
      break;
  }
  return next;
};

// why: roll forward `dueAt` past `nowMs` by repeated unit additions. We
//      loop instead of computing diff because month/year math is
//      non-linear (Feb 30 → Mar 2, leap years, etc) and we want each
//      step to land on a real calendar date the user can recognize.
export const nextDueAfter = (
  dueAt: string,
  recurrence: Recurrence,
  nowMs: number = Date.now(),
): string | null => {
  if (recurrence.every <= 0) return null;
  const base = parseLocal(dueAt);
  if (!base) return null;
  let next = base;
  // why: bail out at 10k iterations to avoid wedging the UI if someone
  //      crafts a malicious zero-progress recurrence; in practice 1-2
  //      iterations is the norm.
  for (let i = 0; i < 10_000; i++) {
    if (next.getTime() > nowMs) return toLocalIso(next);
    next = addUnit(next, recurrence.every, recurrence.unit);
  }
  return null;
};
