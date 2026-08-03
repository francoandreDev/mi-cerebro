// Pure lookups shared by the strata and cordel zoom views: which variant
// authored a given commit, for the left-border color/tooltip on commit rows
// and polaroids. Split out so both views can reuse it without duplicating
// the two-line lookup or threading it through as a callback input.

import type { Variant } from '@core/versioning/variants.types';

export function commitOriginColor(
  oid: string,
  originByOid: ReadonlyMap<string, string>,
  variantsById: ReadonlyMap<string, Variant>,
): string | null {
  const id = originByOid.get(oid);
  if (!id) return null;
  return variantsById.get(id)?.color ?? null;
}

export function commitOriginName(
  oid: string,
  originByOid: ReadonlyMap<string, string>,
  variantsById: ReadonlyMap<string, Variant>,
): string | null {
  const id = originByOid.get(oid);
  if (!id) return null;
  return variantsById.get(id)?.name ?? id;
}
