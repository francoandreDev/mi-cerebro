import { describe, expect, it } from 'vitest';

import { matches } from './shortcuts.service';

const key = (
  k: string,
  mods: Partial<Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>> = {},
): KeyboardEvent => new KeyboardEvent('keydown', { key: k, ...mods });

describe('matches', () => {
  it('matches a bare spacebar combo', () => {
    // why: regression — combo ' ' used to trim to '' and never match.
    expect(matches(' ', key(' '))).toBe(true);
  });

  it('matches a single letter combo', () => {
    expect(matches('j', key('j'))).toBe(true);
    expect(matches('j', key('k'))).toBe(false);
  });

  it('matches Ctrl/Cmd as synonyms', () => {
    expect(matches('Ctrl+K', key('k', { ctrlKey: true }))).toBe(true);
    expect(matches('Ctrl+K', key('k', { metaKey: true }))).toBe(true);
    expect(matches('Ctrl+K', key('k'))).toBe(false);
  });

  it('matches a literal + key', () => {
    expect(matches('+', key('+'))).toBe(true);
    expect(matches('Ctrl++', key('+', { ctrlKey: true }))).toBe(true);
  });

  it('requires shift when the combo asks for it', () => {
    expect(matches('Shift+ArrowRight', key('ArrowRight', { shiftKey: true }))).toBe(true);
    expect(matches('Shift+ArrowRight', key('ArrowRight'))).toBe(false);
  });
});
