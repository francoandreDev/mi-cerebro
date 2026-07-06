// Pure date math for the weekday snooze presets ("próximo lunes" / "fin de
// semana"). Extracted so the ambiguous case — today already being the
// target weekday — has one documented, testable answer instead of being
// buried inside the container.

export const MONDAY = 1;
export const SATURDAY = 6;
const DEFAULT_HOUR = 9;

// why: "next Monday" from a Monday morning should mean *this* Monday if the
//      preset hour hasn't passed yet, otherwise it rolls to next week — same
//      rule a human would apply when asked "cuándo es el próximo lunes".
export function nextWeekdayAfter(from: Date, targetDow: number, hour = DEFAULT_HOUR): Date {
  const candidate = new Date(from.getFullYear(), from.getMonth(), from.getDate(), hour, 0, 0, 0);
  let daysAhead = (targetDow - candidate.getDay() + 7) % 7;
  if (daysAhead === 0 && candidate.getTime() <= from.getTime()) daysAhead = 7;
  candidate.setDate(candidate.getDate() + daysAhead);
  return candidate;
}
