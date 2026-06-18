export const TRASH_RETENTION_DAYS = 30;

const MS_PER_DAY = 86_400_000;

export interface TrashCountdown {
  readonly daysLeft: number;
  readonly daysElapsed: number;
  readonly ratio: number;
  readonly imminent: boolean;
  readonly urgent: boolean;
}

export function computeTrashCountdown(deletedAt: string, now: Date = new Date()): TrashCountdown {
  const deleted = parseDeletedAt(deletedAt) ?? now;
  const elapsedMs = Math.max(0, now.getTime() - deleted.getTime());
  const daysElapsed = Math.min(TRASH_RETENTION_DAYS, Math.floor(elapsedMs / MS_PER_DAY));
  const daysLeft = Math.max(0, TRASH_RETENTION_DAYS - daysElapsed);
  const ratio = daysElapsed / TRASH_RETENTION_DAYS;
  return {
    daysLeft,
    daysElapsed,
    ratio,
    imminent: daysLeft <= 7,
    urgent: daysLeft <= 3,
  };
}

function parseDeletedAt(value: string): Date | null {
  // why: TrashEntry.deletedAt is `YYYY-MM-DD` (joined from parentPath); Date(string)
  //      parses ISO without time as UTC midnight, which is fine for day-granularity.
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
