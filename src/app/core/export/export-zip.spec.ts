import { describe, expect, it } from 'vitest';

import { buildZipFilename, formatStamp, shouldIncludeEntry } from './export-zip';
import { DEFAULT_EXPORT_OPTIONS } from './export-zip.types';

describe('shouldIncludeEntry', () => {
  const base = DEFAULT_EXPORT_OPTIONS;

  it('includes .mi-cerebro always', () => {
    expect(shouldIncludeEntry('.mi-cerebro/config.json', base)).toBe(true);
    expect(shouldIncludeEntry('.mi-cerebro/config.json', { ...base, includeAssets: false })).toBe(
      true,
    );
  });

  it('includes notes/tasks/goals/lists/writings always', () => {
    expect(shouldIncludeEntry('notes/abc.note.json', base)).toBe(true);
    expect(shouldIncludeEntry('tasks/x.task.json', base)).toBe(true);
  });

  it('respects includeAssets for files/images/music', () => {
    expect(shouldIncludeEntry('files/x.bin', { ...base, includeAssets: true })).toBe(true);
    expect(shouldIncludeEntry('images/p.png', { ...base, includeAssets: false })).toBe(false);
    expect(shouldIncludeEntry('music/song.mp3', { ...base, includeAssets: false })).toBe(false);
  });

  it('respects includeAllVariants for .git', () => {
    expect(shouldIncludeEntry('.git/HEAD', { ...base, includeAllVariants: false })).toBe(false);
    expect(shouldIncludeEntry('.git/objects/aa/bb', { ...base, includeAllVariants: true })).toBe(
      true,
    );
  });
});

describe('buildZipFilename', () => {
  it('uses sanitized root name and ISO-like stamp', () => {
    const stamp = new Date('2026-06-15T09:07:00');
    expect(buildZipFilename('Mi Cerebro', stamp)).toBe('mi-cerebro-Mi-Cerebro-2026-06-15-0907.zip');
  });

  it('falls back when name is empty or sanitized to empty', () => {
    const stamp = new Date('2026-01-02T03:04:00');
    expect(buildZipFilename('', stamp)).toBe('mi-cerebro-workspace-2026-01-02-0304.zip');
    expect(buildZipFilename('!!!', stamp)).toBe('mi-cerebro-workspace-2026-01-02-0304.zip');
  });
});

describe('formatStamp', () => {
  it('zero-pads month/day/hour/min', () => {
    expect(formatStamp(new Date('2026-01-02T03:04:05'))).toBe('2026-01-02-0304');
  });
});
