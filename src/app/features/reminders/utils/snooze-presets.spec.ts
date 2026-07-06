import { describe, expect, it } from 'vitest';

import { MONDAY, SATURDAY, nextWeekdayAfter } from './snooze-presets';

describe('nextWeekdayAfter', () => {
  it('rolls forward to the next occurrence of the target weekday', () => {
    // Wed 2026-07-01
    const from = new Date(2026, 6, 1, 10, 0, 0);
    const monday = nextWeekdayAfter(from, MONDAY);
    expect(monday.getDay()).toBe(1);
    expect(monday.getDate()).toBe(6); // next Monday
    expect(monday.getHours()).toBe(9);
  });

  it('keeps today when it is already the target weekday and the preset hour has not passed', () => {
    // Mon 2026-07-06, 07:00 — before the 09:00 preset hour
    const from = new Date(2026, 6, 6, 7, 0, 0);
    const monday = nextWeekdayAfter(from, MONDAY);
    expect(monday.getDate()).toBe(6);
    expect(monday.getHours()).toBe(9);
  });

  it('rolls to next week when today is the target weekday but the preset hour already passed', () => {
    // Mon 2026-07-06, 14:00 — after 09:00
    const from = new Date(2026, 6, 6, 14, 0, 0);
    const monday = nextWeekdayAfter(from, MONDAY);
    expect(monday.getDate()).toBe(13);
  });

  it('resolves the weekend preset to the nearest Saturday', () => {
    // Thu 2026-07-02
    const from = new Date(2026, 6, 2, 10, 0, 0);
    const saturday = nextWeekdayAfter(from, SATURDAY);
    expect(saturday.getDay()).toBe(6);
    expect(saturday.getDate()).toBe(4);
  });
});
