// why: §14 unification — every reminder (user-created or goal-derived)
//      pings at a fixed sequence of offsets BEFORE its target moment,
//      getting denser as it nears, plus a couple of overdue pings after.
//      The user only configures how far in advance the schedule starts
//      (`leadMinutes`); the offsets and progression are fixed so the
//      UX is predictable across all reminders.
//
//      Goals only store a date (`YYYY-MM-DD`); the goal sync layer
//      converts that to `${deadline}T23:59` ("end of that day") before
//      handing it to `nextSlotFor`. User reminders already carry a full
//      local-datetime string, so they're passed through unchanged.

const MS_PER_MIN = 60_000;

// why: minutes-before-target, in increasing order so the sequence is
//      "first ping is the farthest-out one". Each one is shown when the
//      lead-time setting is at least that large.
const PRE_OFFSETS_MIN: readonly number[] = [
  10080, // 1 week
  4320, // 3 days
  1440, // 1 day
  720, // 12 hours
  360, // 6 hours
  180, // 3 hours
  60, // 1 hour
  30,
  10,
  2,
  0, // at the target
];

// why: a couple of escalating overdue pings before we stop nagging.
//      Negative meaning "after the target", so the absolute value is
//      added to targetMs.
const POST_OFFSETS_MIN: readonly number[] = [-60, -360, -1440]; // 1h, 6h, 1d after

const DEADLINE_HOUR = 23;
const DEADLINE_MINUTE = 59;

const pad = (n: number): string => n.toString().padStart(2, '0');

const formatLocal = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

// why: accepts either a date-only string ("2026-07-10" → EOD) or a full
//      local-datetime ("2026-07-10T16:20"). Returns null for anything
//      else so callers degrade gracefully on corrupted data.
export const parseTarget = (target: string): number | null => {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(target);
  if (dateOnly) {
    const [, y, mo, d] = dateOnly as unknown as string[];
    return new Date(+y!, +mo! - 1, +d!, DEADLINE_HOUR, DEADLINE_MINUTE, 0, 0).getTime();
  }
  const dt = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(target);
  if (dt) {
    const [, y, mo, d, h, mi, s] = dt as unknown as string[];
    return new Date(+y!, +mo! - 1, +d!, +h!, +mi!, +(s ?? '0')).getTime();
  }
  return null;
};

// why: returns the earliest scheduled ping strictly after `fromMs`. Pre-
//      target offsets larger than `leadMinutes` are skipped (the user
//      asked not to start nagging that early); everything from `lead`
//      down to 0 + post-target pings is always considered.
export const nextSlotFor = (target: string, fromMs: number, leadMinutes: number): string | null => {
  const targetMs = parseTarget(target);
  if (targetMs === null) return null;
  let best: number | null = null;
  for (const off of PRE_OFFSETS_MIN) {
    if (off > leadMinutes) continue;
    const t = targetMs - off * MS_PER_MIN;
    if (t > fromMs && (best === null || t < best)) best = t;
  }
  for (const off of POST_OFFSETS_MIN) {
    const t = targetMs + Math.abs(off) * MS_PER_MIN;
    if (t > fromMs && (best === null || t < best)) best = t;
  }
  if (best === null) return null;
  return formatLocal(new Date(best));
};

// why: legacy alias kept for the goal sync call sites — semantically
//      identical, just clarifies "this came from a goal deadline".
export const nextLeadupSlot = nextSlotFor;

// why: lead-time presets surfaced in settings. The numeric value is what
//      gets stored; the label is i18n'd in the container.
export interface LeadPreset {
  readonly minutes: number;
  readonly labelKey: string;
}

export const LEAD_PRESETS: readonly LeadPreset[] = [
  { minutes: 10080, labelKey: 'settings.reminders.lead.preset.1w' },
  { minutes: 1440, labelKey: 'settings.reminders.lead.preset.1d' },
  { minutes: 360, labelKey: 'settings.reminders.lead.preset.6h' },
  { minutes: 60, labelKey: 'settings.reminders.lead.preset.1h' },
  { minutes: 10, labelKey: 'settings.reminders.lead.preset.10m' },
];
