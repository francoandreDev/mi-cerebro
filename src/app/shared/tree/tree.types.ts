// Generic tree model used by every entity sidebar. A node is either a
// "group" (folder-like, may have children) or a "leaf" (an entity ref).
// The tree itself is dumb to entity types: kind is opaque to it.

export type TreeNodeKind = string;

export interface TreeNodeBadge {
  readonly id: string;
  readonly label: string;
  readonly color: string;
}

export interface TreeNode {
  readonly id: string;
  readonly label: string;
  readonly kind: TreeNodeKind;
  readonly children?: readonly TreeNode[];
  readonly badges?: readonly TreeNodeBadge[];
}

export type FilterDirection = 'general' | 'up' | 'down';

export interface TreeMatch {
  readonly id: string;
  readonly path: readonly string[]; // ancestor ids root-first
  readonly distance: number; // hop distance from active node, 0 = self
}

export interface FilterResult {
  readonly visible: ReadonlySet<string>;
  readonly autoExpand: ReadonlySet<string>;
  readonly matches: readonly TreeMatch[];
}
