// Pure helper that turns a flat list of Variants into a tree-shaped
// projection for the two-pane /variants UI. Principal is the root;
// orphans (parentId pointing nowhere) fall to root level too so they
// stay visible.
//
// Each node carries a `connector` string built from box-drawing chars
// (e.g. `│  ├ `) ready to be rendered as a leading span in the row.

import { PRINCIPAL_VARIANT_ID, type Variant } from '@core/versioning/variants.types';

export interface VariantTreeNode {
  readonly variant: Variant;
  readonly depth: number;
  readonly connector: string;
}

export function buildVariantTree(variants: readonly Variant[]): readonly VariantTreeNode[] {
  const byId = new Map(variants.map((v) => [v.id, v] as const));
  const childrenByParent = new Map<string, Variant[]>();
  const roots: Variant[] = [];

  for (const v of variants) {
    if (v.id === PRINCIPAL_VARIANT_ID) continue;
    if (v.parentId && byId.has(v.parentId)) {
      const arr = childrenByParent.get(v.parentId) ?? [];
      arr.push(v);
      childrenByParent.set(v.parentId, arr);
    } else {
      roots.push(v);
    }
  }

  const sortByActivityDesc = (a: Variant, b: Variant): number =>
    b.lastActivityAt - a.lastActivityAt;
  for (const arr of childrenByParent.values()) arr.sort(sortByActivityDesc);
  roots.sort(sortByActivityDesc);

  const out: VariantTreeNode[] = [];

  const walk = (
    variant: Variant,
    depth: number,
    ancestorIsLast: readonly boolean[],
    isLast: boolean,
  ): void => {
    let connector = '';
    for (const al of ancestorIsLast) connector += al ? '   ' : '│  ';
    if (depth > 0) connector += isLast ? '╰ ' : '├ ';
    out.push({ variant, depth, connector });

    const kids = childrenByParent.get(variant.id) ?? [];
    kids.forEach((k, i) => walk(k, depth + 1, [...ancestorIsLast, isLast], i === kids.length - 1));
  };

  const principal = byId.get(PRINCIPAL_VARIANT_ID);
  if (principal) walk(principal, 0, [], true);
  roots.forEach((r, i) => walk(r, 0, [], i === roots.length - 1));

  return out;
}
