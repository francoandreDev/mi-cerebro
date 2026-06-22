import type { TaskSummary } from '../models/task.types';

export type Bucket = 'today' | 'week' | 'backlog';

export interface BucketedTask {
  readonly summary: TaskSummary;
  readonly bucket: Bucket;
  readonly overdue: boolean;
}

export interface TaskBuckets {
  readonly today: readonly BucketedTask[];
  readonly week: readonly BucketedTask[];
  readonly backlog: readonly BucketedTask[];
}

// why: "esta semana" se define explícitamente como los próximos 7 días desde
//      hoy, no "hasta domingo" — evita ambigüedad cross-locale y desplazos
//      semanales raros cerca del fin de semana.
const WEEK_DAYS = 7;

export const bucketTasks = (tasks: readonly TaskSummary[], now: Date): TaskBuckets => {
  const today = toIsoDate(now);
  const weekCutoff = toIsoDate(addDays(now, WEEK_DAYS));
  const today_: BucketedTask[] = [];
  const week_: BucketedTask[] = [];
  const backlog_: BucketedTask[] = [];
  for (const summary of tasks) {
    const next = summary.dueDates[0];
    if (!next) {
      backlog_.push({ summary, bucket: 'backlog', overdue: false });
      continue;
    }
    const due = next.slice(0, 10);
    if (due <= today) {
      today_.push({ summary, bucket: 'today', overdue: due < today && !summary.done });
    } else if (due <= weekCutoff) {
      week_.push({ summary, bucket: 'week', overdue: false });
    } else {
      backlog_.push({ summary, bucket: 'backlog', overdue: false });
    }
  }
  return { today: today_, week: week_, backlog: backlog_ };
};

export const bucketToDueDate = (bucket: Bucket, now: Date): readonly string[] => {
  if (bucket === 'today') return [toIsoDate(now)];
  // why: para "esta semana" cae al cuarto día desde hoy (mitad del rango de 7
  //      días) — un default razonable que el usuario puede ajustar luego.
  if (bucket === 'week') return [toIsoDate(addDays(now, 3))];
  return [];
};

const toIsoDate = (d: Date): string => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number): Date => {
  const copy = new Date(d.getTime());
  copy.setUTCDate(copy.getUTCDate() + n);
  return copy;
};
