import { describe, expect, it } from 'vitest';

import { filterTree } from './filter';
import type { TreeNode } from './tree.types';

const tree: readonly TreeNode[] = [
  {
    id: 'g',
    label: 'Notas',
    kind: 'group',
    children: [
      { id: 'a', label: 'Receta de tarta', kind: 'note' },
      { id: 'b', label: 'Diario', kind: 'note' },
      { id: 'c', label: 'Récetario', kind: 'note' },
      {
        id: 'sub',
        label: 'Subgrupo',
        kind: 'group',
        children: [{ id: 'd', label: 'tarta de manzana', kind: 'note' }],
      },
    ],
  },
];

describe('filterTree', () => {
  it('returns everything visible and no matches when query is empty', () => {
    const r = filterTree(tree, '', null, 'general');
    expect(r.visible.size).toBe(6);
    expect(r.matches).toHaveLength(0);
    expect(r.autoExpand.size).toBe(0);
  });

  it('matches case- and accent-insensitively', () => {
    const r = filterTree(tree, 'receta', null, 'general');
    expect(r.matches.map((m) => m.id).sort()).toEqual(['a', 'c']);
  });

  it('autoexpands ancestors of every match', () => {
    const r = filterTree(tree, 'manzana', null, 'general');
    expect([...r.autoExpand].sort()).toEqual(['g', 'sub']);
    expect(r.visible.has('g')).toBe(true);
    expect(r.visible.has('sub')).toBe(true);
    expect(r.visible.has('d')).toBe(true);
    expect(r.visible.has('a')).toBe(false);
  });

  it('ranks matches by distance from active node in general direction', () => {
    const r = filterTree(tree, 'tarta', 'b', 'general');
    expect(r.matches.map((m) => m.id)).toEqual(['a', 'd']);
  });

  it('filters out backward matches when direction is "down"', () => {
    const r = filterTree(tree, 'tarta', 'c', 'down');
    expect(r.matches.map((m) => m.id)).toEqual(['d']);
  });

  it('filters out forward matches when direction is "up"', () => {
    const r = filterTree(tree, 'tarta', 'c', 'up');
    expect(r.matches.map((m) => m.id)).toEqual(['a']);
  });
});
