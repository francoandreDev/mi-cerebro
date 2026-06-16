// Constants and helpers for AutocommitService. Kept here so the
// service file stays focused on orchestration.

// Default timer interval; the live value comes from
// `SettingsService.state().versioning.autocommitMinutes` and is reapplied
// by `AutocommitService` on change.
export const DEFAULT_AUTOCOMMIT_TIMER_MS = 5 * 60 * 1000;
export const AUTOCOMMIT_MINUTES_MIN = 1;
export const AUTOCOMMIT_MINUTES_MAX = 180;
export const AUTOCOMMIT_THROTTLE_MS = 60 * 1000;

export function autocommitMinutesToMs(minutes: number): number {
  const clamped = Math.max(
    AUTOCOMMIT_MINUTES_MIN,
    Math.min(AUTOCOMMIT_MINUTES_MAX, Math.round(minutes)),
  );
  return clamped * 60 * 1000;
}

// Pretty-name per kind for the commit message. Anything not listed
// falls back to the raw kind. Singular form; the count is prefixed.
const KIND_LABELS: Record<string, { singular: string; plural: string }> = {
  notes: { singular: 'note', plural: 'notes' },
  tasks: { singular: 'task', plural: 'tasks' },
  goals: { singular: 'goal', plural: 'goals' },
  lists: { singular: 'list', plural: 'lists' },
  writings: { singular: 'writing', plural: 'writings' },
  images: { singular: 'image', plural: 'images' },
  files: { singular: 'file', plural: 'files' },
  music: { singular: 'track', plural: 'tracks' },
  reminders: { singular: 'reminder', plural: 'reminders' },
};

export function deriveAutocommitMessage(
  filepaths: readonly string[],
  now: Date = new Date(),
): string {
  const counts = new Map<string, number>();
  for (const path of filepaths) {
    const kind = path.split('/')[0] ?? 'other';
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  const parts = [...counts.entries()].map(([kind, n]) => {
    const label = KIND_LABELS[kind];
    if (!label) return `${n} ${kind}`;
    return `${n} ${n === 1 ? label.singular : label.plural}`;
  });
  const stamp = formatStamp(now);
  return `auto: ${parts.join(', ')} (${stamp})`;
}

function formatStamp(d: Date): string {
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}
