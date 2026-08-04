import type { InputRule } from '@tiptap/core';
import { describe, expect, it, vi } from 'vitest';

import { createEntityMentionExtension, type EntityMentionRange } from './entity-mention.ext';

// why: TipTap's InputRule only fires through the browser's real text-input
//      pipeline (handleTextInput on the ProseMirror view) — a live Editor
//      driven by editor.commands.insertContent() never triggers it (that
//      API dispatches a transaction directly, bypassing handleTextInput
//      entirely), so a full-Editor integration test would pass even if the
//      rule itself were broken. Testing find/handler directly is what
//      actually exercises our logic; TipTap's own plugin wiring that turns
//      a matched InputRule into a firing handler is upstream, already
//      covered by their test suite.
const getInputRule = (onTrigger: (range: EntityMentionRange) => void): InputRule => {
  const extension = createEntityMentionExtension(onTrigger);
  const rules = (extension.config.addInputRules as () => InputRule[]).call(extension);
  const rule = rules[0];
  if (!rule) throw new Error('expected an InputRule');
  return rule;
};

describe('createEntityMentionExtension', () => {
  it('matches "@" at the start of a block', () => {
    const rule = getInputRule(vi.fn());
    const find = rule.find as RegExp;
    expect(find.test('@')).toBe(true);
  });

  it('matches "@" typed after whitespace', () => {
    const rule = getInputRule(vi.fn());
    const find = rule.find as RegExp;
    expect(find.test('hola @')).toBe(true);
  });

  it('does not match "@" mid-word (e.g. an email address)', () => {
    const rule = getInputRule(vi.fn());
    const find = rule.find as RegExp;
    expect(find.test('user@')).toBe(false);
  });

  it('reports a range covering only the "@" character', () => {
    const onTrigger = vi.fn<(range: EntityMentionRange) => void>();
    const rule = getInputRule(onTrigger);
    // why: mirrors the shape InputRule's handler actually receives — only
    //      `range` is read by our handler, so the rest is left out.
    rule.handler({ range: { from: 4, to: 5 } } as Parameters<InputRule['handler']>[0]);
    expect(onTrigger).toHaveBeenCalledExactlyOnceWith({ from: 4, to: 5 });
  });
});
