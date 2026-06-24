import { describe, expect, it } from 'vitest';

import { LEAD_PRESETS, nextLeadupSlot, nextSlotFor } from './goal-cadence.utils';

const at = (y: number, mo: number, d: number, h = 9, mi = 0): number =>
  new Date(y, mo - 1, d, h, mi, 0, 0).getTime();

describe('nextLeadupSlot', () => {
  it('picks the first pre-deadline ping when lead is wide', () => {
    // deadline 2026-07-10 23:59, lead = 1 week, "now" = 2026-07-01 14:00
    // → first eligible offset is 1d (1440), so 2026-07-09T23:59.
    const slot = nextLeadupSlot('2026-07-10', at(2026, 7, 1, 14), 10080);
    expect(slot).toBe('2026-07-03T23:59');
  });

  it('honors a short lead by skipping farther offsets', () => {
    // lead = 1 hour: 7 days out, no pre-deadline candidate matches; the
    // first eligible is 1 hour before deadline.
    const slot = nextLeadupSlot('2026-07-10', at(2026, 7, 1, 14), 60);
    expect(slot).toBe('2026-07-10T22:59');
  });

  it('returns the next denser ping as the deadline approaches', () => {
    // deadline 23:59, now 23:30 → next is 23:49 (10m before).
    const slot = nextLeadupSlot('2026-07-10', at(2026, 7, 10, 23, 30), 1440);
    expect(slot).toBe('2026-07-10T23:49');
  });

  it('schedules post-deadline pings once overdue', () => {
    // deadline 2026-07-10 23:59, now 2026-07-11 00:30 → next is +1h after deadline.
    const slot = nextLeadupSlot('2026-07-10', at(2026, 7, 11, 0, 30), 1440);
    expect(slot).toBe('2026-07-11T00:59');
  });

  it('returns null after the last overdue ping', () => {
    // 2 days after deadline: no candidates left.
    const slot = nextLeadupSlot('2026-07-10', at(2026, 7, 13, 0), 1440);
    expect(slot).toBeNull();
  });

  it('returns null for a malformed deadline', () => {
    expect(nextLeadupSlot('garbage', at(2026, 7, 1), 1440)).toBeNull();
  });

  it('exposes a sensible default set of presets', () => {
    expect(LEAD_PRESETS.length).toBeGreaterThan(0);
    expect(LEAD_PRESETS[0]!.minutes).toBeGreaterThan(
      LEAD_PRESETS[LEAD_PRESETS.length - 1]!.minutes,
    );
  });

  it('handles full datetime targets (user-created reminders)', () => {
    // target = 2026-07-10 16:20, now = 2026-07-10 15:00, lead = 1h
    // → first eligible offset is 1h (60), so 15:20.
    const slot = nextSlotFor('2026-07-10T16:20', at(2026, 7, 10, 15, 0), 60);
    expect(slot).toBe('2026-07-10T15:20');
  });

  it('densifies pings as a datetime target approaches', () => {
    // target = 16:20, now = 16:15 → next is 16:18 (2m offset).
    const slot = nextSlotFor('2026-07-10T16:20', at(2026, 7, 10, 16, 15), 1440);
    expect(slot).toBe('2026-07-10T16:18');
  });
});
