import type { FilterDirection, FilterResult, TreeMatch, TreeNode } from './tree.types';

const norm = (s: string): string => s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

interface IndexedNode {
  readonly node: TreeNode;
  readonly path: readonly string[];
  readonly preorder: number; // dfs visit order
}

const indexTree = (roots: readonly TreeNode[]): readonly IndexedNode[] => {
  const out: IndexedNode[] = [];
  let order = 0;
  const walk = (node: TreeNode, ancestors: readonly string[]): void => {
    out.push({ node, path: ancestors, preorder: order++ });
    const next = [...ancestors, node.id];
    for (const child of node.children ?? []) walk(child, next);
  };
  for (const r of roots) walk(r, []);
  return out;
};

const distance = (
  active: IndexedNode | undefined,
  candidate: IndexedNode,
  direction: FilterDirection,
): number => {
  if (!active) return candidate.preorder;
  const delta = candidate.preorder - active.preorder;
  if (direction === 'up') return delta >= 0 ? Number.POSITIVE_INFINITY : -delta;
  if (direction === 'down') return delta <= 0 ? Number.POSITIVE_INFINITY : delta;
  return Math.abs(delta);
};

// why: when query is empty we return everything visible and no matches; the
//      UI uses matches.length to decide whether to highlight or not.
export const filterTree = (
  roots: readonly TreeNode[],
  query: string,
  activeId: string | null,
  direction: FilterDirection,
): FilterResult => {
  const index = indexTree(roots);
  if (query.trim() === '') {
    const visible = new Set<string>(index.map((n) => n.node.id));
    return { visible, autoExpand: new Set(), matches: [] };
  }
  const needle = norm(query.trim());
  const active = activeId ? index.find((n) => n.node.id === activeId) : undefined;

  const hits = index.filter((n) => norm(n.node.label).includes(needle));
  const visible = new Set<string>();
  const autoExpand = new Set<string>();
  for (const hit of hits) {
    visible.add(hit.node.id);
    for (const a of hit.path) {
      visible.add(a);
      autoExpand.add(a);
    }
  }
  const matches: TreeMatch[] = hits
    .map((n) => ({
      id: n.node.id,
      path: n.path,
      distance: distance(active, n, direction),
    }))
    .filter((m) => Number.isFinite(m.distance))
    .sort((a, b) => a.distance - b.distance);
  return { visible, autoExpand, matches };
};
