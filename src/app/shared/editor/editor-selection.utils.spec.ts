// 13f — Unit tests for the pure helpers used by EditorComponent to drive
// bubble/popover positioning and to identify the block under the caret.

import { describe, expect, it } from 'vitest';

import { BLOCK_ID_ATTR } from '@core/tiptap/block-id/block-id.types';

import { blockIdAtSelection, cloudRect, selectionRect } from './editor-selection.utils';

interface FakeEditor {
  readonly state: {
    selection: {
      from: number;
      to: number;
      $from: { depth: number; node: (d: number) => { attrs: Record<string, unknown> } };
    };
  };
  readonly view: {
    coordsAtPos: (pos: number) => { top: number; left: number; bottom: number; right: number };
  };
}

const fakeEditor = (
  attrsByDepth: readonly Record<string, unknown>[],
  coords: ReadonlyMap<number, { top: number; left: number; bottom: number; right: number }>,
  from = 0,
  to = 0,
): FakeEditor => ({
  state: {
    selection: {
      from,
      to,
      $from: {
        depth: attrsByDepth.length - 1,
        node: (d: number) => ({ attrs: attrsByDepth[d] ?? {} }),
      },
    },
  },
  view: {
    coordsAtPos: (pos: number) => coords.get(pos) ?? { top: 0, left: 0, bottom: 0, right: 0 },
  },
});

const fakeHost = (rect: { top: number; left: number }): HTMLElement =>
  ({
    getBoundingClientRect: () => ({
      ...rect,
      bottom: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
    querySelector: () => null,
  }) as unknown as HTMLElement;

describe('blockIdAtSelection', () => {
  it('returns the nearest ancestor blockId walking up from $from', () => {
    const ed = fakeEditor(
      [{ [BLOCK_ID_ATTR]: 'outer' }, { [BLOCK_ID_ATTR]: 'inner' }, {}],
      new Map(),
    );
    expect(blockIdAtSelection(ed as never)).toBe('inner');
  });

  it('falls back through depths until it finds one', () => {
    const ed = fakeEditor([{ [BLOCK_ID_ATTR]: 'root' }, {}, {}], new Map());
    expect(blockIdAtSelection(ed as never)).toBe('root');
  });

  it('returns null when no ancestor carries a blockId', () => {
    const ed = fakeEditor([{}, {}], new Map());
    expect(blockIdAtSelection(ed as never)).toBeNull();
  });
});

describe('selectionRect', () => {
  it('returns the bottom of the selection in host-local space', () => {
    const ed = fakeEditor(
      [{}],
      new Map([
        [0, { top: 10, left: 20, bottom: 30, right: 40 }],
        [5, { top: 12, left: 60, bottom: 32, right: 80 }],
      ]),
      0,
      5,
    );
    const pos = selectionRect(ed as never, fakeHost({ top: 5, left: 0 }));
    // bottom = max(30, 32) - 5 + 6 = 33
    expect(pos.top).toBe(33);
    // left = (20 + 80) / 2 - 0 = 50
    expect(pos.left).toBe(50);
  });
});

describe('cloudRect', () => {
  it('falls back to (0,0) when the cloud is not found in the host', () => {
    const host = fakeHost({ top: 0, left: 0 });
    expect(cloudRect(host, 'missing')).toEqual({ top: 0, left: 0 });
  });
});
