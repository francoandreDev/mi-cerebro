// §20c: la URL de detalle usa <slug-del-título>-<id> en vez del UUID crudo,
// por legibilidad — pero el id completo sigue siendo la fuente de verdad
// (el mapa id → ruta vive en el índice, §8). El slug es cosmético: renombrar
// el título no rompe links guardados porque el componente de detalle sigue
// resolviendo por el id, no por el slug.

import { toSlug } from '@shared/utils/slug';

const UUID_AT_END = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export const entitySlugSegment = (title: string, id: string, fallback = 'nota'): string =>
  `${toSlug(title, fallback)}-${id}`;

// why: links viejos (pre-§20c, guardados como bookmark) son el UUID crudo
//      sin slug — al no matchear ningún prefijo antes del UUID, el propio
//      segmento completo cae en el grupo capturado, así que siguen andando.
export const extractEntityId = (segment: string): string => {
  const match = UUID_AT_END.exec(segment);
  return match ? match[0] : segment;
};
