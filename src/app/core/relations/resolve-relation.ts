import { routeFor } from '@core/search/kind-routes';
import type { SearchIndexService } from '@core/search/search-index.service';

import type { EntityRef, Relation } from './relation.types';

export type RelationDirection = 'outgoing' | 'backlink';

export interface ResolvedRelation {
  readonly relationId: string;
  readonly kind: string;
  readonly entityId: string;
  // why: null = huérfana — el índice de búsqueda no la tiene (entidad
  //      borrada/en papelera). Se resuelve en vivo, no hay flag persistido
  //      (ver features.md §10bis).
  readonly title: string | null;
  readonly route: readonly string[];
  readonly origin: Relation['origin'];
  readonly contextSnippet: string | undefined;
}

// why: cada Relation sólo guarda {kind, id} en sus dos extremos — el
//      título/ruta actuales se resuelven acá contra el índice de §10 en vez
//      de duplicarse en relations.json (features.md §10bis).
export const resolveRelations = (
  relations: readonly Relation[],
  direction: RelationDirection,
  search: SearchIndexService,
): readonly ResolvedRelation[] => relations.map((r) => resolveOne(r, direction, search));

const resolveOne = (
  relation: Relation,
  direction: RelationDirection,
  search: SearchIndexService,
): ResolvedRelation => {
  const other: EntityRef = direction === 'outgoing' ? relation.to : relation.from;
  const title = search.getTitle(other.id);
  return {
    relationId: relation.id,
    kind: other.kind,
    entityId: other.id,
    title,
    route: routeFor(other.kind, other.id, title ?? ''),
    origin: relation.origin,
    contextSnippet: relation.contextSnippet,
  };
};
