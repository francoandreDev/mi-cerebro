// why: quick-add parses an "@hint" tail on the title into a local-time
//      ISO (YYYY-MM-DDTHH:mm) so the user can type "Llamar mamá @mañana 9"
//      and skip the datetime picker. No timezone math — see reminder.types.

export interface ParsedQuickAdd {
  readonly title: string;
  readonly dueAt: string;
}

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  miércoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  sábado: 6,
};

const pad = (n: number): string => n.toString().padStart(2, '0');

const toLocalIso = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

const stripAccents = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

const parseAmPm = (t: string): { h: number; m: number } | null => {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/.exec(t);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? '0');
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  return { h, m: min };
};

const parseTime = (token: string): { h: number; m: number } | null => {
  const t = token.toLowerCase().trim();
  const ampm = parseAmPm(t);
  if (ampm) return ampm;
  const hm = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (hm) return { h: Number(hm[1]), m: Number(hm[2]) };
  const hOnly = /^(\d{1,2})h?$/.exec(t);
  if (!hOnly) return null;
  const h = Number(hOnly[1]);
  return h >= 0 && h <= 23 ? { h, m: 0 } : null;
};

const nextWeekday = (from: Date, target: number): Date => {
  const d = new Date(from);
  const diff = (target - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d;
};

const parseRelative = (tokens: readonly string[]): Date | null => {
  // "en 2h", "en 30m", "en 2 dias"
  if (tokens[0] !== 'en' || tokens.length < 2) return null;
  const joined = tokens.slice(1).join(' ');
  const m = /^(\d+)\s*(h|hs?|hora|horas|m|min|minutos|d|dia|dias|días)$/.exec(joined);
  if (!m || m[1] === undefined || m[2] === undefined) return null;
  const n = Number(m[1]);
  const unit = m[2];
  const now = new Date();
  if (/^(h|hs?|hora|horas)$/.test(unit)) now.setHours(now.getHours() + n);
  else if (/^(m|min|minutos)$/.test(unit)) now.setMinutes(now.getMinutes() + n);
  else now.setDate(now.getDate() + n);
  return now;
};

const DAY_OFFSETS: Record<string, number> = {
  '': 0,
  hoy: 0,
  manana: 1,
  'pasado manana': 2,
  pasado: 2,
};

// "viernes que viene" means the same as "viernes" (next occurrence) — the
// suffix is just emphasis, so it's stripped before the weekday lookup.
const stripQueViene = (dayKey: string): string => dayKey.replace(/\s+que viene$/, '');

const SATURDAY = 6;

const parseAbsoluteDate = (base: Date, dayKey: string): boolean => {
  const m = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/.exec(dayKey);
  if (!m || m[1] === undefined || m[2] === undefined) return false;
  const day = Number(m[1]);
  const month = Number(m[2]) - 1;
  if (day < 1 || day > 31 || month < 0 || month > 11) return false;
  let year = base.getFullYear();
  if (m[3] !== undefined) {
    year = Number(m[3]);
    if (year < 100) year += 2000;
  }
  const candidate = new Date(year, month, day);
  if (candidate.getMonth() !== month || candidate.getDate() !== day) return false; // invalid day (31/02, etc.)
  // No explicit year given and the date already passed this year: roll to next year.
  if (m[3] === undefined) {
    const today = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    if (candidate < today) candidate.setFullYear(year + 1);
  }
  base.setFullYear(candidate.getFullYear(), candidate.getMonth(), candidate.getDate());
  return true;
};

const applyDayKey = (base: Date, rawDayKey: string): boolean => {
  const dayKey = stripQueViene(rawDayKey);
  const offset = DAY_OFFSETS[dayKey];
  if (offset !== undefined) {
    base.setDate(base.getDate() + offset);
    return true;
  }
  if (dayKey === 'fin de semana' || dayKey === 'finde') {
    const next = base.getDay() === SATURDAY ? new Date(base) : nextWeekday(base, SATURDAY);
    base.setFullYear(next.getFullYear(), next.getMonth(), next.getDate());
    return true;
  }
  if (dayKey === 'proximo mes' || dayKey === 'el proximo mes') {
    base.setMonth(base.getMonth() + 1);
    return true;
  }
  if (parseAbsoluteDate(base, dayKey)) return true;
  const wd = Object.entries(WEEKDAYS).find(([k]) => stripAccents(k) === dayKey)?.[1];
  if (wd === undefined) return false;
  const next = nextWeekday(base, wd);
  base.setFullYear(next.getFullYear(), next.getMonth(), next.getDate());
  return true;
};

export const parseDueHint = (hint: string, now: Date = new Date()): string | null => {
  const cleaned = stripAccents(hint).toLowerCase().trim();
  if (!cleaned) return null;

  const tokens = cleaned.split(/\s+/);
  const rel = parseRelative(tokens);
  if (rel) return toLocalIso(rel);

  const last = tokens[tokens.length - 1] ?? '';
  const time = parseTime(last);
  const dayKey = (time ? tokens.slice(0, -1) : tokens).join(' ');

  const base = new Date(now);
  base.setSeconds(0, 0);
  if (!applyDayKey(base, dayKey)) return null;
  base.setHours(time?.h ?? 9, time?.m ?? 0, 0, 0);
  return toLocalIso(base);
};

const DEFAULT_OFFSET_MS = 60 * 60 * 1000;

const defaultDueAt = (now: Date): string => toLocalIso(new Date(now.getTime() + DEFAULT_OFFSET_MS));

export const parseQuickAdd = (raw: string, now: Date = new Date()): ParsedQuickAdd => {
  const at = raw.lastIndexOf('@');
  if (at < 0) return { title: raw.trim(), dueAt: defaultDueAt(now) };
  const title = raw.slice(0, at).trim();
  const hint = raw.slice(at + 1).trim();
  const parsed = parseDueHint(hint, now);
  return { title, dueAt: parsed ?? defaultDueAt(now) };
};
