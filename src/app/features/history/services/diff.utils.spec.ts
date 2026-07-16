import { describe, expect, it } from 'vitest';

import { compactDiffChunks, hasContextChunk } from './diff.utils';
import type { InlineDiffChunk } from './diff.utils';

describe('compactDiffChunks', () => {
  it('collapses a single context run into one separator', () => {
    const chunks: InlineDiffChunk[] = [
      { kind: 'context', value: 'sin cambios 1\n' },
      { kind: 'context', value: 'sin cambios 2\n' },
      { kind: 'add', value: 'nuevo\n' },
    ];
    expect(compactDiffChunks(chunks)).toEqual([
      { kind: 'context', value: '…\n' },
      { kind: 'add', value: 'nuevo\n' },
    ]);
  });

  it('inserts one separator between two visible groups', () => {
    const chunks: InlineDiffChunk[] = [
      { kind: 'remove', value: 'viejo\n' },
      { kind: 'context', value: 'sin cambios\n' },
      { kind: 'add', value: 'nuevo\n' },
    ];
    expect(compactDiffChunks(chunks)).toEqual([
      { kind: 'remove', value: 'viejo\n' },
      { kind: 'context', value: '…\n' },
      { kind: 'add', value: 'nuevo\n' },
    ]);
  });

  it('does not add a trailing separator for trailing context', () => {
    const chunks: InlineDiffChunk[] = [
      { kind: 'add', value: 'nuevo\n' },
      { kind: 'context', value: 'sin cambios\n' },
    ];
    expect(compactDiffChunks(chunks)).toEqual([{ kind: 'add', value: 'nuevo\n' }]);
  });

  it('leaves chunks untouched when there is no context', () => {
    const chunks: InlineDiffChunk[] = [
      { kind: 'remove', value: 'viejo\n' },
      { kind: 'add', value: 'nuevo\n' },
    ];
    expect(compactDiffChunks(chunks)).toEqual(chunks);
  });
});

describe('hasContextChunk', () => {
  it('detects presence of a context chunk', () => {
    expect(hasContextChunk([{ kind: 'context', value: 'x\n' }])).toBe(true);
    expect(hasContextChunk([{ kind: 'add', value: 'x\n' }])).toBe(false);
  });
});
