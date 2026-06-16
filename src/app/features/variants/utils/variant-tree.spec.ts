import { describe, expect, it } from 'vitest';

import { PRINCIPAL_VARIANT_ID, type Variant } from '../../../core/versioning/variants.types';

import { buildVariantTree } from './variant-tree';

const v = (id: string, parentId: string | null, lastActivityAt = 0): Variant =>
  ({
    id,
    name: id,
    color: '#000',
    parentId,
    forkOid: parentId ? 'abc' : null,
    refs: {
      main: `variant/${id}/main`,
      draft: `variant/${id}/draft`,
      comments: `variant/${id}/comments`,
    },
    lastActivityAt,
    protected: id === PRINCIPAL_VARIANT_ID,
    pendingDelete: false,
  }) as Variant;

describe('buildVariantTree', () => {
  it('places principal at the root with no connector', () => {
    const out = buildVariantTree([v(PRINCIPAL_VARIANT_ID, null)]);
    expect(out).toHaveLength(1);
    expect(out[0]!.depth).toBe(0);
    expect(out[0]!.connector).toBe('');
  });

  it('indents children under their parent with branch connectors', () => {
    const tree = buildVariantTree([
      v(PRINCIPAL_VARIANT_ID, null),
      v('a', PRINCIPAL_VARIANT_ID, 2),
      v('b', PRINCIPAL_VARIANT_ID, 1),
    ]);
    expect(tree.map((n) => n.variant.id)).toEqual([PRINCIPAL_VARIANT_ID, 'a', 'b']);
    expect(tree[1]!.depth).toBe(1);
    expect(tree[1]!.connector).toBe('├ ');
    expect(tree[2]!.connector).toBe('╰ ');
  });

  it('uses pipe continuation for grandchildren when the parent is not last', () => {
    const tree = buildVariantTree([
      v(PRINCIPAL_VARIANT_ID, null),
      v('a', PRINCIPAL_VARIANT_ID, 2),
      v('b', PRINCIPAL_VARIANT_ID, 1),
      v('a1', 'a', 1),
    ]);
    const aChild = tree.find((n) => n.variant.id === 'a1')!;
    expect(aChild.depth).toBe(2);
    expect(aChild.connector).toBe('│  ╰ ');
  });

  it('places orphans (missing parent ref) at root level', () => {
    const tree = buildVariantTree([v(PRINCIPAL_VARIANT_ID, null), v('orphan', 'nonexistent')]);
    const o = tree.find((n) => n.variant.id === 'orphan')!;
    expect(o.depth).toBe(0);
    expect(o.connector).toBe('');
  });

  it('sorts siblings by lastActivityAt desc', () => {
    const tree = buildVariantTree([
      v(PRINCIPAL_VARIANT_ID, null),
      v('old', PRINCIPAL_VARIANT_ID, 1),
      v('new', PRINCIPAL_VARIANT_ID, 5),
      v('mid', PRINCIPAL_VARIANT_ID, 3),
    ]);
    expect(tree.slice(1).map((n) => n.variant.id)).toEqual(['new', 'mid', 'old']);
  });
});
