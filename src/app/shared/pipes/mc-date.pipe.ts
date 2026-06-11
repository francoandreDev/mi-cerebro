import { Pipe, inject, type PipeTransform } from '@angular/core';

import { SettingsService } from '@core/settings/settings.service';

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

@Pipe({ name: 'mcDate', standalone: true, pure: false })
export class McDatePipe implements PipeTransform {
  private readonly settings = inject(SettingsService);

  transform(value: string | Date | number | null | undefined, relative = false): string {
    if (value === null || value === undefined || value === '') return '';
    const resolved = resolveDate(value, this.settings.timezone());
    if (!resolved) return String(value);
    const [absolute, anchor] = resolved;
    if (!relative) return absolute;
    const rel = relativeEs(anchor, new Date());
    return rel ? `${absolute} (${rel})` : absolute;
  }
}

const resolveDate = (
  value: string | Date | number,
  timezone: string,
): readonly [string, Date] | null => {
  if (typeof value === 'string' && DATE_ONLY_RE.test(value)) {
    // why: date-only inputs (deadline, deletedAt buckets) carry no time
    //      precision — applying a timezone would imply data that doesn't
    //      exist.
    return [formatDateOnly(value), new Date(`${value}T00:00:00Z`)];
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return [formatInTimezone(date, timezone), date];
};

const formatDateOnly = (iso: string): string => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const DATETIME_FMT_CACHE = new Map<string, Intl.DateTimeFormat>();

const formatterFor = (timezone: string): Intl.DateTimeFormat => {
  const cached = DATETIME_FMT_CACHE.get(timezone);
  if (cached) return cached;
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  DATETIME_FMT_CACHE.set(timezone, fmt);
  return fmt;
};

const formatInTimezone = (date: Date, timezone: string): string => {
  const parts = formatterFor(timezone).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}:${get('second')}`;
};

interface DurationParts {
  years: number;
  months: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const calendarDiff = (from: Date, to: Date): DurationParts => {
  let years = to.getUTCFullYear() - from.getUTCFullYear();
  let months = to.getUTCMonth() - from.getUTCMonth();
  let days = to.getUTCDate() - from.getUTCDate();
  let hours = to.getUTCHours() - from.getUTCHours();
  let minutes = to.getUTCMinutes() - from.getUTCMinutes();
  let seconds = to.getUTCSeconds() - from.getUTCSeconds();
  if (seconds < 0) {
    minutes -= 1;
    seconds += 60;
  }
  if (minutes < 0) {
    hours -= 1;
    minutes += 60;
  }
  if (hours < 0) {
    days -= 1;
    hours += 24;
  }
  if (days < 0) {
    months -= 1;
    const borrowMonth = (to.getUTCMonth() + 11) % 12;
    const borrowYear = to.getUTCFullYear() - (to.getUTCMonth() === 0 ? 1 : 0);
    days += daysInMonth(borrowYear, borrowMonth);
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days, hours, minutes, seconds };
};

const daysInMonth = (year: number, monthZero: number): number =>
  new Date(Date.UTC(year, monthZero + 1, 0)).getUTCDate();

const UNIT_LABELS: readonly (readonly [keyof DurationParts, string, string])[] = [
  ['years', 'año', 'años'],
  ['months', 'mes', 'meses'],
  ['days', 'día', 'días'],
  ['hours', 'hora', 'horas'],
  ['minutes', 'minuto', 'minutos'],
  ['seconds', 'segundo', 'segundos'],
];

const formatDuration = (parts: DurationParts): string => {
  const tokens: string[] = [];
  for (const [key, singular, plural] of UNIT_LABELS) {
    const n = parts[key];
    if (n <= 0) continue;
    tokens.push(`${n} ${n === 1 ? singular : plural}`);
  }
  if (tokens.length === 0) return '';
  if (tokens.length === 1) return tokens[0]!;
  const last = tokens.pop()!;
  return `${tokens.join(' ')} y ${last}`;
};

const relativeEs = (date: Date, now: Date): string => {
  const past = date.getTime() <= now.getTime();
  const [from, to] = past ? [date, now] : [now, date];
  const duration = formatDuration(calendarDiff(from, to));
  if (!duration) return '';
  return past ? `hace ${duration}` : `en ${duration}`;
};
