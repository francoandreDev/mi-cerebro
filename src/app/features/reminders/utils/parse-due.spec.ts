import { describe, expect, it } from 'vitest';

import { parseDueHint, parseQuickAdd } from './parse-due';

describe('parseDueHint', () => {
  it('parses weekday names to the next occurrence', () => {
    // Wed 2026-07-01
    const now = new Date(2026, 6, 1, 10, 0, 0);
    const result = parseDueHint('viernes', now);
    expect(result).toBe('2026-07-03T09:00');
  });

  it('parses "que viene" as emphasis on the same weekday', () => {
    const now = new Date(2026, 6, 1, 10, 0, 0);
    expect(parseDueHint('viernes que viene', now)).toBe(parseDueHint('viernes', now));
  });

  it('resolves "fin de semana" to the coming Saturday', () => {
    // Wed 2026-07-01
    const now = new Date(2026, 6, 1, 10, 0, 0);
    const result = parseDueHint('fin de semana', now);
    expect(result).toBe('2026-07-04T09:00');
  });

  it('keeps today when "fin de semana" is requested on a Saturday', () => {
    const now = new Date(2026, 6, 4, 10, 0, 0); // Sat 2026-07-04
    const result = parseDueHint('fin de semana', now);
    expect(result).toBe('2026-07-04T09:00');
  });

  it('resolves "proximo mes" to the same day next month', () => {
    const now = new Date(2026, 6, 15, 10, 0, 0);
    const result = parseDueHint('proximo mes', now);
    expect(result).toBe('2026-08-15T09:00');
  });

  it('parses an absolute dd/mm date rolling to next year if already passed', () => {
    const now = new Date(2026, 6, 15, 10, 0, 0); // 2026-07-15
    expect(parseDueHint('01/01', now)).toBe('2027-01-01T09:00');
    expect(parseDueHint('25/12', now)).toBe('2026-12-25T09:00');
  });

  it('parses an absolute date with explicit year', () => {
    const now = new Date(2026, 6, 15, 10, 0, 0);
    expect(parseDueHint('01/01/2028', now)).toBe('2028-01-01T09:00');
  });

  it('rejects an invalid absolute date', () => {
    const now = new Date(2026, 6, 15, 10, 0, 0);
    expect(parseDueHint('31/02', now)).toBeNull();
  });

  it('combines an absolute date with a time', () => {
    const now = new Date(2026, 6, 15, 10, 0, 0);
    expect(parseDueHint('25/12 20:00', now)).toBe('2026-12-25T20:00');
  });
});

describe('parseQuickAdd', () => {
  it('falls back to now + 1h when there is no @hint', () => {
    const now = new Date(2026, 6, 1, 10, 0, 0);
    const result = parseQuickAdd('Llamar mamá', now);
    expect(result.title).toBe('Llamar mamá');
    expect(result.dueAt).toBe('2026-07-01T11:00');
  });

  it('splits the title from an absolute-date hint', () => {
    const now = new Date(2026, 6, 1, 10, 0, 0);
    const result = parseQuickAdd('Pagar alquiler @01/08', now);
    expect(result.title).toBe('Pagar alquiler');
    expect(result.dueAt).toBe('2026-08-01T09:00');
  });

  it('parses a trailing natural-date phrase without the @ marker', () => {
    // Wed 2026-07-01
    const now = new Date(2026, 6, 1, 10, 0, 0);
    const result = parseQuickAdd('Pagar alquiler viernes', now);
    expect(result.title).toBe('Pagar alquiler');
    expect(result.dueAt).toBe('2026-07-03T09:00');
  });

  it('parses a trailing weekday + time without the @ marker', () => {
    const now = new Date(2026, 6, 1, 10, 0, 0);
    const result = parseQuickAdd('Reunion equipo viernes 9', now);
    expect(result.title).toBe('Reunion equipo');
    expect(result.dueAt).toBe('2026-07-03T09:00');
  });

  it('leaves a plain title untouched when no trailing word is a date', () => {
    const now = new Date(2026, 6, 1, 10, 0, 0);
    const result = parseQuickAdd('Llamar al plomero', now);
    expect(result.title).toBe('Llamar al plomero');
    expect(result.dueAt).toBe('2026-07-01T11:00');
  });

  it('does not consume a lone-word title as a date', () => {
    const now = new Date(2026, 6, 1, 10, 0, 0);
    const result = parseQuickAdd('viernes', now);
    expect(result.title).toBe('viernes');
    expect(result.dueAt).toBe('2026-07-01T11:00');
  });
});
